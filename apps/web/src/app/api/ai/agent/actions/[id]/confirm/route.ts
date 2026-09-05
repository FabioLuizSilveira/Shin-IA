import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { buildAgentContext } from "@/lib/ai/agent-context";
import { buildMutationToolRegistry } from "@/lib/ai/actions/tools";
import { AI_ACTION_EVENTS } from "@/lib/ai/audit-events";
import { logActivity } from "@/lib/activity-log";
import { hasValidStepUp } from "@/lib/auth/require-step-up";

export const dynamic = "force-dynamic";

interface PlanRow {
  id: string;
  tool_name: string;
  risk_level: string;
  requires_aal2: boolean;
  args: Record<string, unknown>;
  status: string;
  expires_at: string;
}

// The ONLY place a Wave 6 mutation actually runs — the tool loop
// (api/ai/agent/route.ts) only ever proposes a plan, never this. Permission
// is re-checked here from scratch (never trusted from proposal time), the
// plan's tenant/status/expiry are all re-verified, and requires_aal2 (no
// action wired this round sets it true, but the check is real, not a stub)
// gates on the already-built-but-previously-unused step-up cookie.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const { data: plan, error: fetchError } = await scope.db
    .from("agent_action_plans")
    .select("id, tool_name, risk_level, requires_aal2, args, status, expires_at")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!plan) return NextResponse.json({ error: "action plan not found" }, { status: 404 });
  const row = plan as PlanRow;

  if (row.status !== "pending") {
    return NextResponse.json({ error: `plan is already "${row.status}"` }, { status: 409 });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await scope.db.from("agent_action_plans").update({ status: "expired" }).eq("id", id);
    return NextResponse.json({ error: "action plan expired" }, { status: 410 });
  }

  const ctx = await buildAgentContext(scope, {});
  const mutationRegistry = buildMutationToolRegistry();
  const tool = mutationRegistry.get(row.tool_name);
  if (!tool) return NextResponse.json({ error: "tool no longer available" }, { status: 410 });

  // Re-checked fresh — a permission revoked between proposal and
  // confirmation must block execution, never fall back to what was true
  // when the plan was created.
  if (!ctx.permissions.includes(tool.requiredPermission)) {
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "agent_action_plan",
      entityId: id,
      action: AI_ACTION_EVENTS.DENIED,
      metadata: { tool: row.tool_name, reason: "permission_revoked" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.requires_aal2 && !(await hasValidStepUp(scope.userId))) {
    return NextResponse.json(
      { error: "step-up verification required", code: "step_up_required" },
      { status: 428 },
    );
  }

  await scope.db
    .from("agent_action_plans")
    .update({
      status: "confirmed",
      confirmed_by: scope.userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "agent_action_plan",
    entityId: id,
    action: AI_ACTION_EVENTS.CONFIRMED,
    metadata: { tool: row.tool_name },
  });

  const result = await tool.execute(row.args, ctx, scope);

  await scope.db
    .from("agent_action_plans")
    .update({
      status: result.ok ? "executed" : "rejected",
      executed_at: result.ok ? new Date().toISOString() : null,
      result: result.ok ? result.data : null,
      error: result.ok ? null : result.error,
    })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "agent_action_plan",
    entityId: id,
    action: result.ok ? AI_ACTION_EVENTS.EXECUTED : AI_ACTION_EVENTS.EXECUTION_FAILED,
    metadata: { tool: row.tool_name, error: result.ok ? undefined : result.error },
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ data: result.data });
}
