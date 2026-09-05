import type { AgentTool } from "../tool-types";
import { sanitizePostgrestFilterValue } from "@/lib/postgrest-filter";

// "Customer" here is the CRM-style organizations(type='customer') entity —
// NOT the separate, tenant-agnostic rental_customers/rental_customer_
// organizations auth-identity model (that one has no search/list concept,
// only per-user provisioning). Same distinction GET /api/organizations and
// the ⌘K search route (search/route.ts) already draw.
const SELECT = "id, name, type, document, email, address_city, active";

export const searchCustomersTool: AgentTool<{ query?: string }> = {
  name: "search_customers",
  description: "Busca clientes (organizações do tipo customer) do tenant por nome.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Texto para buscar no nome do cliente" },
    },
  },
  requiredPermission: "tenant.customers.view",
  requiredFeature: "agent.tools.customers",
  async execute(args, _ctx, scope) {
    let q = scope.db
      .from("organizations")
      .select(SELECT)
      .eq("tenant_id", scope.tenantId)
      .eq("type", "customer")
      .is("deleted_at", null);
    if (args.query) {
      const safe = sanitizePostgrestFilterValue(args.query).trim();
      if (safe) q = q.ilike("name", `%${safe}%`);
    }
    const { data, error } = await q.order("name", { ascending: true }).limit(25);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  },
};

export const getCustomerTool: AgentTool<{ customerId: string }> = {
  name: "get_customer",
  description: "Detalhes de um cliente específico do tenant, pelo ID.",
  inputSchema: {
    type: "object",
    properties: { customerId: { type: "string", description: "UUID do cliente/organização" } },
    required: ["customerId"],
  },
  requiredPermission: "tenant.customers.view",
  requiredFeature: "agent.tools.customers",
  async execute(args, _ctx, scope) {
    const { data, error } = await scope.db
      .from("organizations")
      .select(SELECT)
      .eq("id", args.customerId)
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "customer not found" };
    return { ok: true, data };
  },
};
