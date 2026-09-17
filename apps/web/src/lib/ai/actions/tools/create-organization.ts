import type { AgentMutationTool } from "../types";
import { logActivity } from "@/lib/activity-log";

const VALID_TYPES = ["customer", "supplier", "partner", "internal"];

interface Args {
  name?: string;
  trade_name?: string;
  document?: string;
  type?: string;
  email?: string;
  phone?: string;
  address_city?: string;
  address_state?: string;
}

// Wraps POST /api/organizations' exact validation and insert logic — never
// a parallel implementation of "create an organization." Same shape as
// create-asset.ts, extended to cover the CRM entity the agent couldn't
// create before (it only had create_asset, which is why a request like
// "cadastre esse cliente" used to get misrouted toward "asset type").
export const createOrganizationTool: AgentMutationTool<Args> = {
  name: "create_organization",
  description:
    "Cadastra um cliente, fornecedor ou parceiro (organização) no tenant — a partir de dados fornecidos em texto ou extraídos de um documento/imagem anexado.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Razão social / nome da organização" },
      trade_name: { type: "string", description: "Nome fantasia, opcional" },
      document: { type: "string", description: "CNPJ ou CPF" },
      type: {
        type: "string",
        description: "Tipo de relação com o tenant",
        enum: VALID_TYPES,
      },
      email: { type: "string", description: "E-mail de contato, opcional" },
      phone: { type: "string", description: "Telefone de contato, opcional" },
      address_city: { type: "string", description: "Cidade" },
      address_state: { type: "string", description: "UF (sigla do estado)" },
    },
    required: ["name", "document", "type", "address_city", "address_state"],
  },
  riskLevel: "LOW_RISK_WRITE",
  requiredPermission: "tenant.customers.create",
  requiredFeature: "agent.actions.customers",
  domain: "ORGANIZATION",
  intents: ["CREATE"],
  async validate(args) {
    if (!args.name?.trim() || !args.document?.trim()) {
      return { ok: false, error: "name and document are required" };
    }
    if (!args.type || !VALID_TYPES.includes(args.type)) {
      return { ok: false, error: `type must be one of: ${VALID_TYPES.join(", ")}` };
    }
    if (!args.address_city?.trim() || !args.address_state?.trim()) {
      return { ok: false, error: "address_city and address_state are required" };
    }
    return { ok: true };
  },
  async summarize(args) {
    const TYPE_LABEL: Record<string, string> = {
      customer: "cliente",
      supplier: "fornecedor",
      partner: "parceiro",
      internal: "interna",
    };
    return `Cadastrar ${TYPE_LABEL[args.type!] ?? args.type} "${args.name}" (documento: ${args.document}, ${args.address_city}/${args.address_state}).`;
  },
  async describeFields(args) {
    const TYPE_LABEL: Record<string, string> = {
      customer: "Cliente",
      supplier: "Fornecedor",
      partner: "Parceiro",
      internal: "Interna",
    };
    const fields: { label: string; value: string }[] = [
      { label: "Razão social", value: args.name ?? "" },
      { label: "Documento", value: args.document ?? "" },
      { label: "Tipo", value: TYPE_LABEL[args.type ?? ""] ?? args.type ?? "" },
      { label: "Cidade", value: args.address_city ?? "" },
      { label: "Estado", value: args.address_state ?? "" },
    ];
    if (args.trade_name?.trim()) fields.push({ label: "Nome fantasia", value: args.trade_name });
    if (args.email?.trim()) fields.push({ label: "E-mail", value: args.email });
    if (args.phone?.trim()) fields.push({ label: "Telefone", value: args.phone });
    return fields;
  },
  resultEntity(_data, args) {
    return args.name ? { entityType: "ORGANIZATION", displayName: args.name } : null;
  },
  async execute(args, _ctx, scope) {
    const { data: created, error: insertError } = await scope.db
      .from("organizations")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: scope.tenantId,
        name: args.name!.trim(),
        trade_name: args.trade_name?.trim() || null,
        document: args.document!.trim(),
        type: args.type,
        email: args.email?.trim() || null,
        phone: args.phone?.trim() || null,
        address_city: args.address_city!.trim(),
        address_state: args.address_state!.trim(),
      })
      .select("id, name, trade_name, document, type, email, phone, address_city, address_state")
      .single();
    if (insertError || !created)
      return { ok: false, error: insertError?.message ?? "insert failed" };

    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "organization",
      entityId: created.id as string,
      action: "created",
      metadata: { name: args.name, type: args.type, source: "shina_agent" },
    });

    return { ok: true, data: created };
  },
};
