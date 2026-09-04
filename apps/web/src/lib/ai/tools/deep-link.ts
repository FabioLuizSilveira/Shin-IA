import type { AgentTool } from "../tool-types";
import { buildDeepLinkUrl, type DeepLinkTarget } from "@/lib/push/deep-link";

// Only entity types the tenant already has permission to view are ever
// linkable, and any entity-scoped id is re-validated against
// scope.tenantId before a link is built — never trust an id the model
// names without a tenant-scoped existence check (same discipline as
// get_contract_signature_status). Deliberately v1-scoped to the types
// this tool can properly validate (contract/asset table lookup + a real
// permission key) plus notification_center (no entity id at all) —
// invoice/operation are real DeepLinkTarget variants but adding them here
// needs their own confirmed permission key + tenant-scoped lookup table,
// not guessed, so they're left out of the tool until that's confirmed.
const TARGET_TYPES = ["contract", "asset", "notification_center"] as const;
type TargetType = (typeof TARGET_TYPES)[number];

const REQUIRED_PERMISSION: Partial<Record<TargetType, string>> = {
  contract: "tenant.contracts.view",
  asset: "tenant.assets.view",
};

export const getDeepLinkTool: AgentTool<{ targetType: string; targetId?: string }> = {
  name: "get_deep_link",
  description:
    "Gera um link direto pro app pra um recurso específico (contrato ou ativo), pra o usuário abrir a tela certa.",
  inputSchema: {
    type: "object",
    properties: {
      targetType: {
        type: "string",
        description: "Tipo de recurso",
        enum: [...TARGET_TYPES],
      },
      targetId: {
        type: "string",
        description: "UUID do recurso (não necessário pra notification_center)",
      },
    },
    required: ["targetType"],
  },
  requiredFeature: "agent.tools.deeplink",
  async execute(args, ctx, scope) {
    const targetType = args.targetType as TargetType;
    if (!TARGET_TYPES.includes(targetType)) {
      return { ok: false, error: `tipo de recurso desconhecido: ${targetType}` };
    }

    const requiredPermission = REQUIRED_PERMISSION[targetType];
    if (requiredPermission && !ctx.permissions.includes(requiredPermission)) {
      return { ok: false, error: "você não tem permissão pra ver esse tipo de recurso" };
    }

    if (targetType === "notification_center") {
      return { ok: true, data: { url: buildDeepLinkUrl({ type: "notification_center" }) } };
    }

    if (!args.targetId) {
      return { ok: false, error: "targetId é obrigatório pra esse tipo de recurso" };
    }

    // Tenant-scoped existence check BEFORE building any link — a
    // cross-tenant id must never resolve to a real link.
    const table =
      targetType === "contract" ? "contracts" : targetType === "asset" ? "assets" : null;
    if (table) {
      const { data: row } = await scope.db
        .from(table)
        .select("id")
        .eq("id", args.targetId)
        .eq("tenant_id", scope.tenantId)
        .maybeSingle();
      if (!row) return { ok: false, error: "recurso não encontrado" };
    }

    const target: DeepLinkTarget =
      targetType === "contract"
        ? { type: "contract", id: args.targetId }
        : { type: "asset", id: args.targetId };

    return { ok: true, data: { url: buildDeepLinkUrl(target) } };
  },
};
