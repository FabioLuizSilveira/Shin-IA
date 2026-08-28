import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { canTransitionCase, type InfractionCaseStatus } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string[]> = {
  pending: ["ready", "expired"],
  ready: ["submitted", "expired"],
  submitted: ["accepted", "rejected"],
  accepted: [],
  rejected: ["ready"],
  expired: [],
  not_required: [],
};

interface PatchBody {
  status?: string;
  externalProtocol?: string;
  notes?: string;
}

// PATCH .../driver-identification/:driverIdentificationId — moves the
// indication through submitted/accepted/rejected/expired (item 20).
// Accepting flips the case to driver_identified.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; driverIdentificationId: string }> },
) {
  const { id, driverIdentificationId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.review"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await scope.db
    .from("infraction_driver_identifications")
    .select("id, status")
    .eq("id", driverIdentificationId)
    .eq("case_id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as PatchBody;
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });
  if (!ALLOWED[current.status]?.includes(body.status)) {
    return NextResponse.json(
      { error: `cannot transition from ${current.status} to ${body.status}` },
      { status: 422 },
    );
  }

  const { error: updateError } = await scope.db
    .from("infraction_driver_identifications")
    .update({
      status: body.status,
      external_protocol: body.externalProtocol ?? undefined,
      notes: body.notes ?? undefined,
      submitted_at: body.status === "submitted" ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", driverIdentificationId)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  if (body.status === "accepted") {
    const { data: infractionCase } = await scope.db
      .from("infraction_cases")
      .select("status")
      .eq("id", id)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (
      infractionCase &&
      canTransitionCase(infractionCase.status as InfractionCaseStatus, "driver_identified")
    ) {
      await scope.db
        .from("infraction_cases")
        .update({ status: "driver_identified", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", scope.tenantId);
    }
  }

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_driver_identification",
    entityId: driverIdentificationId,
    action: "status_changed",
    metadata: { from: current.status, to: body.status },
  });

  return NextResponse.json({ data: { ok: true } });
}
