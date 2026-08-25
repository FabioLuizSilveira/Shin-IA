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
  resolutionNotes?: string;
}

// PATCH /api/inspections/:id/disputes/:disputeId — staff review of a
// customer-raised divergence (item 5 of the spec). Same
// review_damage permission as finding review — reviewing a customer's
// "I don't agree" claim is the same authority level as reviewing a
// technical avaria.
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
  if (!(await hasTenantPermission(scope, "tenant.inspections.review_damage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: dispute, error: fetchError } = await scope.db
    .from("inspection_disputes")
    .select("id, status")
    .eq("id", disputeId)
    .eq("inspection_id", id)
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
    .from("inspection_disputes")
    .update({
      status: body.status,
      resolution_notes: body.resolutionNotes ?? null,
      resolved_by: body.status === "resolved" ? scope.userId : undefined,
      resolved_at: body.status === "resolved" ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", disputeId)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection_dispute",
    entityId: disputeId,
    action: "status_changed",
    metadata: { from: dispute.status, to: body.status },
  });

  return NextResponse.json({ data: { ok: true } });
}
