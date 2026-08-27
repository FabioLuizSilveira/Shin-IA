import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["under_analysis", "accepted", "rejected"],
  under_analysis: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
  expired: [],
};

interface PatchDefenseBody {
  status?: string;
  externalProtocol?: string;
  result?: string;
  notes?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; defenseId: string }> },
) {
  const { id, defenseId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.manage_defense"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await scope.db
    .from("infraction_defenses")
    .select("id, status")
    .eq("id", defenseId)
    .eq("case_id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as PatchDefenseBody;
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });
  if (!ALLOWED[current.status]?.includes(body.status)) {
    return NextResponse.json(
      { error: `cannot transition from ${current.status} to ${body.status}` },
      { status: 422 },
    );
  }

  const { error: updateError } = await scope.db
    .from("infraction_defenses")
    .update({
      status: body.status,
      external_protocol: body.externalProtocol ?? undefined,
      result: body.result ?? undefined,
      notes: body.notes ?? undefined,
      submitted_at: body.status === "submitted" ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", defenseId)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_defense",
    entityId: defenseId,
    action: "status_changed",
    metadata: { from: current.status, to: body.status },
  });

  return NextResponse.json({ data: { ok: true } });
}
