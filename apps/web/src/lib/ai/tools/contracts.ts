import type { AgentTool } from "../tool-types";
import { getSignatureStatusForContract } from "@/lib/contract-signature-status";

// Same columns/filter as GET /api/contracts/route.ts.
const SELECT =
  "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, organizations(name)";

export const listContractsTool: AgentTool<{ status?: string }> = {
  name: "list_contracts",
  description: "Lista contratos do tenant, opcionalmente filtrando por status.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Status do contrato (ex: draft, active, terminated)" },
    },
  },
  requiredPermission: "tenant.contracts.view",
  requiredFeature: "agent.tools.contracts",
  async execute(args, _ctx, scope) {
    let q = scope.db
      .from("contracts")
      .select(SELECT)
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null);
    if (args.status) q = q.eq("status", args.status);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(25);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },
};

export const getContractSignatureStatusTool: AgentTool<{ contractId: string }> = {
  name: "get_contract_signature_status",
  description: "Status da assinatura eletrônica de um contrato específico (Clicksign).",
  inputSchema: {
    type: "object",
    properties: {
      contractId: { type: "string", description: "UUID do contrato" },
    },
    required: ["contractId"],
  },
  requiredPermission: "tenant.contracts.view",
  requiredFeature: "agent.tools.contracts",
  async execute(args, _ctx, scope) {
    // Re-scoped internally: confirm the contract belongs to this tenant
    // BEFORE looking up its signature status — a contractId from another
    // tenant must return not-found, never that tenant's real status.
    const { data: contract } = await scope.db
      .from("contracts")
      .select("id")
      .eq("id", args.contractId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!contract) return { ok: false, error: "contract not found" };

    const status = await getSignatureStatusForContract(scope.db, args.contractId);
    return { ok: true, data: status };
  },
};
