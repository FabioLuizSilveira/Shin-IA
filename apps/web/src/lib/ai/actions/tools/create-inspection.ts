import type { AgentMutationTool } from "../types";
import {
  createInspection,
  resolveInspectionAssetAndTemplate,
  AssetNotFoundError,
  NoBlueprintError,
  InspectionTemplateResolutionError,
} from "@/lib/inspections/inspection-service";
import { logActivity } from "@/lib/activity-log";
import type { InspectionType, InspectionPurpose } from "@shina/inspection-engine";

const VALID_TYPES: InspectionType[] = [
  "pre_delivery",
  "check_in",
  "check_out",
  "return",
  "periodic",
  "maintenance",
  "damage",
  "custom",
];
const VALID_PURPOSES: InspectionPurpose[] = ["check_in", "check_out"];

interface Args {
  assetId?: string;
  inspectionType?: InspectionType;
  purpose?: InspectionPurpose;
}

// Agent Runtime v3, Wave 4 ("Multi-Domain") — wraps createInspection()
// (apps/web/src/lib/inspections/inspection-service.ts), extracted this
// wave from POST /api/inspections's own inline logic (blueprint +
// template resolution included) so the route and the Agent share one
// real implementation instead of two.
export const createInspectionTool: AgentMutationTool<Args> = {
  name: "create_inspection",
  description: "Abre uma vistoria/inspeção para um veículo/ativo do tenant.",
  inputSchema: {
    type: "object",
    properties: {
      assetId: { type: "string", description: "UUID do ativo" },
      inspectionType: { type: "string", description: "Tipo de vistoria", enum: VALID_TYPES },
      purpose: {
        type: "string",
        description: "Finalidade da vistoria",
        enum: VALID_PURPOSES,
      },
    },
    required: ["assetId", "inspectionType", "purpose"],
  },
  riskLevel: "LOW_RISK_WRITE",
  requiredPermission: "tenant.inspections.create",
  requiredFeature: "agent.actions.inspections",
  domain: "INSPECTION",
  intents: ["CREATE"],
  async validate(args, _ctx, scope) {
    if (!args.assetId || !args.inspectionType || !args.purpose) {
      return { ok: false, error: "assetId, inspectionType and purpose are required" };
    }
    if (!VALID_TYPES.includes(args.inspectionType)) {
      return { ok: false, error: `inspectionType must be one of: ${VALID_TYPES.join(", ")}` };
    }
    if (!VALID_PURPOSES.includes(args.purpose)) {
      return { ok: false, error: `purpose must be one of: ${VALID_PURPOSES.join(", ")}` };
    }
    try {
      await resolveInspectionAssetAndTemplate(scope.db, scope.tenantId, args.assetId, args.purpose);
    } catch (e) {
      if (e instanceof AssetNotFoundError)
        return { ok: false, error: "assetId not found for this tenant" };
      if (e instanceof NoBlueprintError) {
        return {
          ok: false,
          error: "Ativo não tem blueprint associado — não é possível vistoriar.",
        };
      }
      if (e instanceof InspectionTemplateResolutionError) {
        return { ok: false, error: "Nenhum modelo de vistoria mapeado para essa finalidade." };
      }
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    return { ok: true };
  },
  async summarize(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("name")
      .eq("id", args.assetId)
      .maybeSingle();
    return `Abrir vistoria (${args.inspectionType}, finalidade: ${args.purpose}) para "${asset?.name ?? args.assetId}".`;
  },
  async describeFields(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("name")
      .eq("id", args.assetId)
      .maybeSingle();
    return [
      { label: "Ativo", value: asset?.name ?? args.assetId ?? "" },
      { label: "Tipo", value: args.inspectionType ?? "" },
      { label: "Finalidade", value: args.purpose ?? "" },
    ];
  },
  // No resultEntity() -- entity-context.ts's EntityRelation enum (Wave 1)
  // has no CURRENT_INSPECTION slot, same reasoning as create-rental.ts.
  async execute(args, _ctx, scope) {
    try {
      const inspection = await createInspection(scope.db, {
        tenantId: scope.tenantId,
        responsibleUserId: scope.userId,
        assetId: args.assetId!,
        type: args.inspectionType!,
        purpose: args.purpose!,
      });

      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "inspection",
        entityId: inspection.id,
        action: "created",
        metadata: { assetId: args.assetId, type: args.inspectionType, source: "shina_agent" },
      });

      return { ok: true, data: inspection };
    } catch (e) {
      if (e instanceof AssetNotFoundError) return { ok: false, error: "Ativo não encontrado." };
      if (e instanceof NoBlueprintError) {
        return {
          ok: false,
          error: "Ativo não tem blueprint associado — não é possível vistoriar.",
        };
      }
      if (e instanceof InspectionTemplateResolutionError) {
        return { ok: false, error: "Nenhum modelo de vistoria mapeado para essa finalidade." };
      }
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
