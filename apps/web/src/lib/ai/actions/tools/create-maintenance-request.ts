import type { AgentMutationTool } from "../types";
import { createMaintenanceOrder, AssetNotFoundError } from "@/lib/maintenance/maintenance-service";
import { logActivity } from "@/lib/activity-log";
import type { MaintenanceOrderType } from "@shina/maintenance-engine";

const VALID_TYPES: MaintenanceOrderType[] = [
  "preventive",
  "corrective",
  "predictive",
  "inspection_generated",
  "emergency",
];

interface Args {
  assetId?: string;
  maintenanceType?: MaintenanceOrderType;
  description?: string;
  scheduledAt?: string;
}

// Agent Runtime v3, Wave 4 ("Multi-Domain") — wraps
// createMaintenanceOrder() (apps/web/src/lib/maintenance/maintenance-service.ts),
// extracted this wave from POST /api/maintenance's own inline logic so
// the route and the Agent share one real implementation instead of two.
export const createMaintenanceRequestTool: AgentMutationTool<Args> = {
  name: "create_maintenance_request",
  description: "Abre uma ordem de manutenção para um veículo/ativo do tenant.",
  inputSchema: {
    type: "object",
    properties: {
      assetId: { type: "string", description: "UUID do ativo" },
      maintenanceType: {
        type: "string",
        description: "Tipo de manutenção",
        enum: VALID_TYPES,
      },
      description: { type: "string", description: "Breve descrição do problema ou serviço" },
      scheduledAt: { type: "string", description: "Data/hora agendada, ISO 8601, opcional" },
    },
    required: ["assetId", "maintenanceType", "description"],
  },
  riskLevel: "LOW_RISK_WRITE",
  requiredPermission: "tenant.maintenance.create",
  requiredFeature: "agent.actions.maintenance",
  domain: "MAINTENANCE",
  intents: ["CREATE"],
  async validate(args, _ctx, scope) {
    if (!args.assetId || !args.maintenanceType || !args.description?.trim()) {
      return { ok: false, error: "assetId, maintenanceType and description are required" };
    }
    if (!VALID_TYPES.includes(args.maintenanceType)) {
      return { ok: false, error: `maintenanceType must be one of: ${VALID_TYPES.join(", ")}` };
    }
    const { data: asset } = await scope.db
      .from("assets")
      .select("id")
      .eq("id", args.assetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!asset) return { ok: false, error: "assetId not found for this tenant" };
    return { ok: true };
  },
  async summarize(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("name")
      .eq("id", args.assetId)
      .maybeSingle();
    const when = args.scheduledAt ? `, agendada para ${args.scheduledAt}` : "";
    return `Abrir manutenção ${TYPE_LABEL[args.maintenanceType!] ?? args.maintenanceType} para "${asset?.name ?? args.assetId}": ${args.description}${when}.`;
  },
  async describeFields(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("name")
      .eq("id", args.assetId)
      .maybeSingle();
    const fields: { label: string; value: string }[] = [
      { label: "Ativo", value: asset?.name ?? args.assetId ?? "" },
      {
        label: "Tipo",
        value: TYPE_LABEL[args.maintenanceType ?? ""] ?? args.maintenanceType ?? "",
      },
      { label: "Descrição", value: args.description ?? "" },
    ];
    if (args.scheduledAt) fields.push({ label: "Agendada para", value: args.scheduledAt });
    return fields;
  },
  // No resultEntity() -- entity-context.ts's EntityRelation enum (Wave 1)
  // has no CURRENT_MAINTENANCE_ORDER slot, same reasoning as create-rental.ts.
  async execute(args, _ctx, scope) {
    try {
      const order = await createMaintenanceOrder(scope.db, {
        tenantId: scope.tenantId,
        createdBy: scope.userId,
        assetId: args.assetId!,
        type: args.maintenanceType!,
        description: args.description!,
        scheduledAt: args.scheduledAt ?? null,
      });

      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "maintenance_order",
        entityId: order.id,
        action: "created",
        metadata: { assetId: args.assetId, type: args.maintenanceType, source: "shina_agent" },
      });

      return { ok: true, data: order };
    } catch (e) {
      if (e instanceof AssetNotFoundError) return { ok: false, error: "Ativo não encontrado." };
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

const TYPE_LABEL: Record<string, string> = {
  preventive: "preventiva",
  corrective: "corretiva",
  predictive: "preditiva",
  inspection_generated: "gerada por vistoria",
  emergency: "emergencial",
};
