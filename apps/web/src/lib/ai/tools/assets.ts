import type { AgentTool } from "../tool-types";

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
