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

// Same columns as GET /api/contracts/[id]/route.ts.
const DETAIL_SELECT =
  "id, type, status, value_amount, value_currency, period_starts_at, period_ends_at, created_at, organizations(id, name, type, document, email)";

export const getContractTool: AgentTool<{ contractId: string }> = {
  name: "get_contract",
  description: "Detalhes de um contrato específico do tenant, pelo ID.",
  inputSchema: {
    type: "object",
    properties: { contractId: { type: "string", description: "UUID do contrato" } },
    required: ["contractId"],
  },
  requiredPermission: "tenant.contracts.view",
  requiredFeature: "agent.tools.contracts",
  async execute(args, _ctx, scope) {
    const { data, error } = await scope.db
      .from("contracts")
      .select(DETAIL_SELECT)
      .eq("id", args.contractId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "contract not found" };
    return { ok: true, data };
  },
};

export const getContractsExpiringTool: AgentTool<{ withinDays?: number }> = {
  name: "get_contracts_expiring",
  description: "Lista contratos ativos que vencem dentro de um número de dias (padrão 30).",
  inputSchema: {
    type: "object",
    properties: {
      withinDays: {
        type: "number",
        description: "Janela em dias a partir de hoje, padrão 30, máximo 365",
      },
    },
  },
  requiredPermission: "tenant.contracts.view",
  requiredFeature: "agent.tools.contracts",
  async execute(args, _ctx, scope) {
    const days = args.withinDays && args.withinDays > 0 ? Math.min(args.withinDays, 365) : 30;
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 86_400_000);
    const { data, error } = await scope.db
      .from("contracts")
      .select(SELECT)
      .eq("tenant_id", scope.tenantId)
      .eq("status", "active")
      .is("deleted_at", null)
      .gte("period_ends_at", now.toISOString())
      .lte("period_ends_at", cutoff.toISOString())
      .order("period_ends_at", { ascending: true })
      .limit(25);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },
};

export const getCustomerContractsTool: AgentTool<{ organizationId: string }> = {
  name: "get_customer_contracts",
  description: "Lista os contratos de um cliente/organização específico.",
  inputSchema: {
    type: "object",
    properties: {
      organizationId: { type: "string", description: "UUID da organização/cliente" },
    },
    required: ["organizationId"],
  },
  requiredPermission: "tenant.contracts.view",
  requiredFeature: "agent.tools.contracts",
  async execute(args, _ctx, scope) {
    // Scoped by this tenant's own contracts regardless of whether
    // organizationId is real or belongs to another tenant — an id from
    // another tenant simply matches nothing here, never leaks their data.
    const { data, error } = await scope.db
      .from("contracts")
      .select(SELECT)
      .eq("tenant_id", scope.tenantId)
      .eq("organization_id", args.organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },
};
