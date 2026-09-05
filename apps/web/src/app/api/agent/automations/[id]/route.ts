import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

interface PatchBody {
  enabled?: boolean;
  conditions?: Record<string, unknown>;
}

// The tenant owner's enable/disable/pause + inspect-history surface the
// spec requires — "pause" and "disable" are the same operation here
// (enabled: false); there's no separate paused state because a daily
// automation has no in-flight run to suspend mid-execution.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.automations.manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await scope.db
    .from("agent_automations")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "automation not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.conditions) patch.conditions = body.conditions;

  const { error: updateError } = await scope.db
    .from("agent_automations")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  if (typeof body.enabled === "boolean") {
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "agent_automation",
      entityId: id,
      action: body.enabled ? "enabled" : "disabled",
      metadata: {},
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
