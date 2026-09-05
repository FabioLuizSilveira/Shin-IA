import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { AI_ACTION_EVENTS } from "@/lib/ai/audit-events";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: plan, error: fetchError } = await scope.db
    .from("agent_action_plans")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!plan) return NextResponse.json({ error: "action plan not found" }, { status: 404 });
  if (plan.status !== "pending") {
    return NextResponse.json({ error: `plan is already "${plan.status}"` }, { status: 409 });
  }

  const { error: updateError } = await scope.db
    .from("agent_action_plans")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .eq("status", "pending");
  if (updateError) return internalError(updateError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "agent_action_plan",
    entityId: id,
    action: AI_ACTION_EVENTS.CANCELLED,
    metadata: {},
  });

  return NextResponse.json({ data: { ok: true } });
}
