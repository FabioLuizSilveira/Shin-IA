import type { AgentMutationTool } from "../types";

interface Args {
  ids?: string[];
  all?: boolean;
}

// Wraps PATCH /api/notifications' exact logic (that route has no
// hasTenantPermission() check today; the agent path still requires
// tenant.notifications.manage per this platform's permission-scoped
// invariant). Spec's literal LOW_RISK "markAsRead" — the lowest-stakes
// mutation available, a good first real write for the confirmation
// pipeline to prove out.
export const markNotificationsReadTool: AgentMutationTool<Args> = {
  name: "mark_notifications_read",
  description: "Marca notificações do tenant como lidas — todas, ou uma lista específica de IDs.",
  inputSchema: {
    type: "object",
    properties: {
      ids: {
        type: "array",
        items: { type: "string" },
        description: "IDs específicos de notificações para marcar como lidas",
      },
      all: { type: "boolean", description: "Se true, marca todas as notificações não lidas" },
    },
  },
  riskLevel: "LOW_RISK",
  requiredPermission: "tenant.notifications.manage",
  requiredFeature: "agent.actions.notifications",
  async validate(args) {
    if (!args.all && (!args.ids || args.ids.length === 0)) {
      return { ok: false, error: "ids or all is required" };
    }
    return { ok: true };
  },
  async summarize(args, _ctx, scope) {
    if (args.all) {
      const { count } = await scope.db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", scope.tenantId)
        .neq("status", "read")
        .is("deleted_at", null);
      return `Marcar todas as ${count ?? 0} notificações não lidas como lidas.`;
    }
    return `Marcar ${args.ids?.length ?? 0} notificação(ões) específica(s) como lida(s).`;
  },
  async execute(args, _ctx, scope) {
    let q = scope.db
      .from("notifications")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId);
    if (args.all) {
      q = q.neq("status", "read");
    } else if (args.ids && args.ids.length > 0) {
      q = q.in("id", args.ids);
    } else {
      return { ok: false, error: "ids or all is required" };
    }
    const { error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { done: true } };
  },
};
