import type { AgentTool } from "../tool-types";

// Same SELECT/filters as GET /api/infractions/route.ts. Spec lists
// getInfractions and getInfractionsByAsset as two separate functions, but
// the live route already supports assetId as just another optional filter
// on the exact same query — a second tool would be a literal duplicate of
// this one with assetId hardcoded, so both are covered by a single tool
// here (assetId optional) rather than maintaining the same query twice.
const SELECT =
  "id, infraction_id, status, asset_id, match_confidence, contract_id, customer_id, operator_id, " +
  "responsible_party_type, responsible_party_id, responsibility_confidence, created_at, updated_at, " +
  "infractions(id, source, auto_number, plate, occurred_at, amount_cents, amount_currency, authority_name, infraction_code)";

export const getInfractionsTool: AgentTool<{ status?: string; assetId?: string }> = {
  name: "get_infractions",
  description:
    "Lista infrações (multas) do tenant, opcionalmente filtrando por status ou por um ativo específico.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Status do caso de infração" },
      assetId: { type: "string", description: "UUID do ativo, para listar infrações desse ativo" },
    },
  },
  requiredPermission: "tenant.infractions.view",
  requiredFeature: "agent.tools.infractions",
  async execute(args, _ctx, scope) {
    let q = scope.db.from("infraction_cases").select(SELECT).eq("tenant_id", scope.tenantId);
    if (args.status) q = q.eq("status", args.status);
    if (args.assetId) q = q.eq("asset_id", args.assetId);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(25);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },
};
