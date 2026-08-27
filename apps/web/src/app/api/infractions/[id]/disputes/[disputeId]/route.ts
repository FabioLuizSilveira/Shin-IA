import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string[]> = {
  open: ["under_review", "accepted", "rejected"],
  under_review: ["accepted", "rejected"],
  accepted: ["resolved"],
  rejected: ["resolved"],
  resolved: [],
};

interface PatchDisputeBody {
  status?: string;
  decision?: string;
  resolution?: string;
}

// PATCH /api/infractions/:id/disputes/:disputeId — staff review (item 22:
// requester/reason/description/evidence/reviewed_by/decision/resolution).
// Accepting a dispute sends the case's responsibility back to pending so
// it can be re-suggested/reassigned — same pattern as the standalone
// responsibility/reject route.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; disputeId: string }> },
) {
  const { id, disputeId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.review"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: dispute, error: fetchError } = await scope.db
    .from("infraction_disputes")
    .select("id, status")
    .eq("id", disputeId)
    .eq("case_id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });

  const body = (await req.json()) as PatchDisputeBody;
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });
  if (!ALLOWED[dispute.status]?.includes(body.status)) {
    return NextResponse.json(
      { error: `cannot transition from ${dispute.status} to ${body.status}` },
      { status: 422 },
    );
  }

  const { error: updateError } = await scope.db
    .from("infraction_disputes")
    .update({
      status: body.status,
      reviewed_by: scope.userId,
      decision: body.decision ?? null,
      resolution: body.resolution ?? null,
      resolved_at: body.status === "resolved" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", disputeId)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  if (body.status === "accepted") {
    await scope.db
      .from("infraction_cases")
      .update({
        status: "responsibility_pending",
        responsible_party_type: null,
        responsible_party_id: null,
        responsibility_confidence: null,
        responsibility_confirmed_by: null,
        responsibility_confirmed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", scope.tenantId);
  }

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_dispute",
    entityId: disputeId,
    action: "status_changed",
    metadata: { from: dispute.status, to: body.status },
  });

  return NextResponse.json({ data: { ok: true } });
}
