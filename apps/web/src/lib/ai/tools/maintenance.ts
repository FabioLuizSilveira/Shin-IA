import type { AgentTool } from "../tool-types";
import {
  resolvePlanDue,
  type MaintenancePlan,
  type MaintenancePlanTriggerType,
} from "@shina/maintenance-engine";

// Same row->engine-shape mapping as GET /api/maintenance/plans/route.ts
// (that route has no exported helper, so this is its own small copy rather
// than editing the live route for a Wave 3 read-only tool).
function toEngineShape(row: Record<string, unknown>): MaintenancePlan {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    assetId: (row.asset_id as string) ?? null,
    assetTypeId: (row.asset_type_id as string) ?? null,
    name: row.name as string,
    triggerType: row.trigger_type as MaintenancePlanTriggerType,
    intervalDays: (row.interval_days as number) ?? null,
    intervalOdometer: (row.interval_odometer as number) ?? null,
    intervalHourMeter: (row.interval_hour_meter as number) ?? null,
    conditionNotes: (row.condition_notes as string) ?? null,
    lastTriggeredAt: (row.last_triggered_at as string) ?? null,
    lastTriggeredOdometer: (row.last_triggered_odometer as number) ?? null,
    lastTriggeredHourMeter: (row.last_triggered_hour_meter as number) ?? null,
    active: row.active as boolean,
  };
}

export const getMaintenanceDueTool: AgentTool<{ assetId?: string }> = {
  name: "get_maintenance_due",
  description:
    "Lista planos de manutenção ativos do tenant e indica quais estão vencidos ou próximos do vencimento, com base em data/odômetro/horímetro atual.",
  inputSchema: {
    type: "object",
    properties: {
      assetId: { type: "string", description: "UUID do ativo, opcional, para filtrar" },
    },
  },
  requiredPermission: "tenant.maintenance.view",
  requiredFeature: "agent.tools.maintenance",
  async execute(args, _ctx, scope) {
    let q = scope.db
      .from("maintenance_plans")
      .select("*, assets(id, name, odometer, hour_meter)")
      .eq("tenant_id", scope.tenantId)
      .eq("active", true)
      .is("deleted_at", null);
    if (args.assetId) q = q.eq("asset_id", args.assetId);

    const { data, error } = await q.order("name", { ascending: true });
    if (error) return { ok: false, error: error.message };

    const now = new Date();
    const enriched = (data ?? []).map((row) => {
      const asset = row.assets as { id: string; name: string } | null;
      const due = resolvePlanDue(toEngineShape(row), {
        now,
        currentOdometer: (row.assets as { odometer: number | null } | null)?.odometer ?? null,
        currentHourMeter: (row.assets as { hour_meter: number | null } | null)?.hour_meter ?? null,
      });
      return { id: row.id, name: row.name, assetId: row.asset_id, asset, due };
    });
    return { ok: true, data: enriched };
  },
};

export const getMaintenanceOrderTool: AgentTool<{ orderId: string }> = {
  name: "get_maintenance_order",
  description: "Detalhes de uma ordem de manutenção específica, com itens e documentos.",
  inputSchema: {
    type: "object",
    properties: { orderId: { type: "string", description: "UUID da ordem de manutenção" } },
    required: ["orderId"],
  },
  requiredPermission: "tenant.maintenance.view",
  requiredFeature: "agent.tools.maintenance",
  async execute(args, _ctx, scope) {
    const { data: order, error } = await scope.db
      .from("maintenance_orders")
      .select("*, assets(id, name, category), organizations(id, name)")
      .eq("id", args.orderId)
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!order) return { ok: false, error: "maintenance order not found" };

    const [{ data: items }, { data: documents }] = await Promise.all([
      scope.db
        .from("maintenance_items")
        .select("*")
        .eq("maintenance_order_id", args.orderId)
        .order("created_at", { ascending: true }),
      scope.db
        .from("maintenance_documents")
        .select("*")
        .eq("maintenance_order_id", args.orderId)
        .order("created_at", { ascending: false }),
    ]);
    return { ok: true, data: { order, items: items ?? [], documents: documents ?? [] } };
  },
};

export const getMaintenanceHistoryTool: AgentTool<{
  assetId?: string;
  status?: string;
  type?: string;
  periodStart?: string;
  periodEnd?: string;
}> = {
  name: "get_maintenance_history",
  description:
    "Lista ordens de manutenção do tenant, com filtros opcionais de ativo, status, tipo e período.",
  inputSchema: {
    type: "object",
    properties: {
      assetId: { type: "string", description: "UUID do ativo, opcional" },
      status: {
        type: "string",
        description: "Status da ordem (ex: open, in_progress, completed)",
      },
      type: {
        type: "string",
        description: "Tipo de manutenção",
        enum: ["preventive", "corrective", "emergency", "predictive"],
      },
      periodStart: { type: "string", description: "Data inicial, ISO 8601, opcional" },
      periodEnd: { type: "string", description: "Data final, ISO 8601, opcional" },
    },
  },
  requiredPermission: "tenant.maintenance.view",
  requiredFeature: "agent.tools.maintenance",
  async execute(args, _ctx, scope) {
    let q = scope.db
      .from("maintenance_orders")
      .select(
        "id, type, status, opened_at, completed_at, description, asset_id, total_cost_cents, assets(id, name)",
      )
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null);
    if (args.assetId) q = q.eq("asset_id", args.assetId);
    if (args.status) q = q.eq("status", args.status);
    if (args.type) q = q.eq("type", args.type);
    if (args.periodStart) q = q.gte("opened_at", args.periodStart);
    if (args.periodEnd) q = q.lte("opened_at", args.periodEnd);

    const { data, error } = await q.order("opened_at", { ascending: false }).limit(25);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },
};

interface CostRow {
  type: string;
  total_cost_cents: number | null;
}

export const getMaintenanceCostTool: AgentTool<{
  periodStart?: string;
  periodEnd?: string;
  assetId?: string;
}> = {
  name: "get_maintenance_cost",
  description:
    "Custo total de manutenção do tenant em um período, opcionalmente filtrado por ativo, com detalhamento por tipo.",
  inputSchema: {
    type: "object",
    properties: {
      periodStart: { type: "string", description: "Data inicial, ISO 8601, opcional" },
      periodEnd: { type: "string", description: "Data final, ISO 8601, opcional" },
      assetId: { type: "string", description: "UUID do ativo, opcional" },
    },
  },
  // Matches GET /api/maintenance/analytics's own gate — cost data is behind
  // the analytics-specific permission, not the general maintenance.view.
  requiredPermission: "tenant.maintenance.analytics_view",
  requiredFeature: "agent.tools.maintenance",
  async execute(args, _ctx, scope) {
    let q = scope.db
      .from("maintenance_orders")
      .select("type, total_cost_cents")
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null);
    if (args.periodStart) q = q.gte("opened_at", args.periodStart);
    if (args.periodEnd) q = q.lte("opened_at", args.periodEnd);
    if (args.assetId) q = q.eq("asset_id", args.assetId);

    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };

    const rows = (data ?? []) as CostRow[];
    const totalCostCents = rows.reduce((sum, r) => sum + (r.total_cost_cents ?? 0), 0);
    const byType: Record<string, { count: number; costCents: number }> = {};
    for (const r of rows) {
      byType[r.type] ??= { count: 0, costCents: 0 };
      byType[r.type].count += 1;
      byType[r.type].costCents += r.total_cost_cents ?? 0;
    }
    return { ok: true, data: { totalCostCents, orderCount: rows.length, byType } };
  },
};
