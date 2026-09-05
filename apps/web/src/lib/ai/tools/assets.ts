import type { AgentTool } from "../tool-types";
import { findAssetConflicts } from "@/lib/resource-availability";

// Same columns/filter as GET /api/assets/route.ts — kept as its own query
// (not importing from the route file, which has no exported query helper)
// rather than editing that live route for a Wave 1 read-only tool.
const SELECT = "id, name, serial_number, category, status, asset_types(name)";

export const listAssetsTool: AgentTool<{ query?: string; category?: string }> = {
  name: "list_assets",
  description:
    "Lista ativos do tenant, opcionalmente filtrando por texto (nome/número de série) ou categoria.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Texto para buscar no nome ou número de série" },
      category: {
        type: "string",
        description: "Categoria do ativo",
        enum: ["vehicle", "equipment", "tool", "property", "technology"],
      },
    },
  },
  requiredPermission: "tenant.assets.view",
  requiredFeature: "agent.tools.assets",
  async execute(args, _ctx, scope) {
    let q = scope.db
      .from("assets")
      .select(SELECT)
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null);
    if (args.category) q = q.eq("category", args.category);
    if (args.query) {
      // args.query is model-supplied (derived from user text, potentially
      // adversarial via prompt injection) — strip characters with special
      // meaning in a PostgREST filter string before interpolating, so it
      // can only ever narrow the match, never alter the filter's structure.
      const safe = args.query.replace(/[,().]/g, " ").trim();
      if (safe) q = q.or(`name.ilike.%${safe}%,serial_number.ilike.%${safe}%`);
    }
    const { data, error } = await q.order("name", { ascending: true }).limit(25);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },
};

export const getAssetTool: AgentTool<{ assetId: string }> = {
  name: "get_asset",
  description: "Detalhes de um ativo específico do tenant, pelo ID.",
  inputSchema: {
    type: "object",
    properties: { assetId: { type: "string", description: "UUID do ativo" } },
    required: ["assetId"],
  },
  requiredPermission: "tenant.assets.view",
  requiredFeature: "agent.tools.assets",
  async execute(args, _ctx, scope) {
    const { data, error } = await scope.db
      .from("assets")
      .select(SELECT)
      .eq("id", args.assetId)
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "asset not found" };
    return { ok: true, data };
  },
};

// Wraps findAssetConflicts() (the same overlap-conflict check the booking
// flow itself relies on, see resource-availability.ts) into a yes/no
// availability answer for a given window — no separate availability
// algorithm invented here.
export const getAssetAvailabilityTool: AgentTool<{
  assetId: string;
  startsAt: string;
  endsAt: string;
}> = {
  name: "get_asset_availability",
  description:
    "Verifica se um ativo está disponível (sem conflito de agendamento) em um intervalo de datas (ISO 8601).",
  inputSchema: {
    type: "object",
    properties: {
      assetId: { type: "string", description: "UUID do ativo" },
      startsAt: { type: "string", description: "Início do intervalo, ISO 8601" },
      endsAt: { type: "string", description: "Fim do intervalo, ISO 8601" },
    },
    required: ["assetId", "startsAt", "endsAt"],
  },
  requiredPermission: "tenant.assets.view",
  requiredFeature: "agent.tools.assets",
  async execute(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("id")
      .eq("id", args.assetId)
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!asset) return { ok: false, error: "asset not found" };

    try {
      const conflicts = await findAssetConflicts(scope.db, {
        tenantId: scope.tenantId,
        assetId: args.assetId,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
      });
      return { ok: true, data: { available: conflicts.length === 0, conflicts } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

// Maintenance data specifically, matching GET /assets/:id/maintenance's own
// permission gate (tenant.maintenance.view, not tenant.assets.view) — this
// tool exposes the same underlying data, so it re-checks the same key
// rather than the weaker asset-view permission.
export const getAssetHistoryTool: AgentTool<{ assetId: string }> = {
  name: "get_asset_history",
  description:
    "Histórico de manutenções de um ativo específico, com resumo de custo total e número de ordens.",
  inputSchema: {
    type: "object",
    properties: { assetId: { type: "string", description: "UUID do ativo" } },
    required: ["assetId"],
  },
  requiredPermission: "tenant.maintenance.view",
  requiredFeature: "agent.tools.assets",
  async execute(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("id, name, category")
      .eq("id", args.assetId)
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!asset) return { ok: false, error: "asset not found" };

    const { data: orders, error } = await scope.db
      .from("maintenance_orders")
      .select("id, type, status, opened_at, completed_at, description, total_cost_cents")
      .eq("tenant_id", scope.tenantId)
      .eq("asset_id", args.assetId)
      .is("deleted_at", null)
      .order("opened_at", { ascending: false })
      .limit(20);
    if (error) return { ok: false, error: error.message };

    const rows = (orders ?? []) as { total_cost_cents: number | null }[];
    const totalCostCents = rows.reduce((sum, r) => sum + (r.total_cost_cents ?? 0), 0);
    return {
      ok: true,
      data: { asset, orders: orders ?? [], summary: { totalCostCents, orderCount: rows.length } },
    };
  },
};
