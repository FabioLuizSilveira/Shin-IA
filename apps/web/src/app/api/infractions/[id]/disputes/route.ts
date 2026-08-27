import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { canTransitionCase, type InfractionResponsiblePartyType } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

interface CreateDisputeBody {
  partyType?: InfractionResponsiblePartyType;
  partyId?: string;
  reason?: string;
  description?: string;
}

// POST /api/infractions/:id/disputes — item 22's internal contestation
// flow ("Eu não estava conduzindo o veículo naquele horário"). Its own
// small entity, not the same one the operator/tenant "confirm/reject"
// responsibility routes use — a dispute is a claim raised by the party
// being held responsible, to be reviewed separately, same architecture
// decision already made for the Inspection Engine's customer disputes.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.review"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: infractionCase, error: caseError } = await scope.db
    .from("infraction_cases")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const body = (await req.json()) as CreateDisputeBody;
  if (!body.partyType || !body.description) {
    return NextResponse.json({ error: "partyType and description are required" }, { status: 400 });
  }

  const disputeId = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("infraction_disputes").insert({
    id: disputeId,
    tenant_id: scope.tenantId,
    case_id: id,
    party_type: body.partyType,
    party_id: body.partyId ?? null,
    reason: body.reason ?? null,
    description: body.description,
    status: "open",
  });
  if (insertError) return internalError(insertError);

  if (canTransitionCase(infractionCase.status, "disputed")) {
    await scope.db
      .from("infraction_cases")
      .update({ status: "disputed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", scope.tenantId);
  }

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_case",
    entityId: id,
    action: "disputed",
    metadata: { disputeId, partyType: body.partyType },
  });

  return NextResponse.json({ data: { id: disputeId } }, { status: 201 });
}
