import type { AgentMutationTool } from "../types";
import { createTowingServiceRequest, TowingConflictError } from "@/lib/transport/towing-service";
import { logActivity } from "@/lib/activity-log";

interface Args {
  towTruckAssetId?: string;
  scheduledStartsAt?: string;
  scheduledEndsAt?: string;
  origin?: string;
  destination?: string;
  description?: string;
  customerOrganizationId?: string;
  operatorResourceId?: string;
}

// Agent Runtime v3, Wave 2 -- wraps createTowingServiceRequest()
// (apps/web/src/lib/transport/towing-service.ts), same real, already-
// built, conflict-checked domain service as create-transport-request.ts
// (ZERO callers before this, confirmed by a real grep audit).
export const createTowingRequestTool: AgentMutationTool<Args> = {
  name: "create_towing_request",
  description:
    "Cria uma solicitação de guincho para um veículo guincho, período e (opcionalmente) origem, destino e cliente.",
  inputSchema: {
    type: "object",
    properties: {
      towTruckAssetId: { type: "string", description: "UUID do guincho (veículo)" },
      scheduledStartsAt: { type: "string", description: "Data/hora do atendimento, ISO 8601" },
      scheduledEndsAt: { type: "string", description: "Data/hora estimada de término, ISO 8601" },
      origin: { type: "string", description: "Local de origem, opcional" },
      destination: { type: "string", description: "Destino, opcional" },
      description: { type: "string", description: "Descrição do problema, opcional" },
      customerOrganizationId: { type: "string", description: "UUID do cliente, opcional" },
      operatorResourceId: { type: "string", description: "UUID do operador/recurso, opcional" },
    },
    required: ["towTruckAssetId", "scheduledStartsAt", "scheduledEndsAt"],
  },
  riskLevel: "LOW_RISK_WRITE",
  requiredPermission: "tenant.towing.create",
  requiredFeature: "agent.actions.towing",
  domain: "TOWING",
  intents: ["CREATE"],
  async validate(args, _ctx, scope) {
    if (!args.towTruckAssetId || !args.scheduledStartsAt || !args.scheduledEndsAt) {
      return {
        ok: false,
        error: "towTruckAssetId, scheduledStartsAt and scheduledEndsAt are required",
      };
    }
    if (new Date(args.scheduledStartsAt) >= new Date(args.scheduledEndsAt)) {
      return { ok: false, error: "scheduledStartsAt must be before scheduledEndsAt" };
    }
    const { data: asset } = await scope.db
      .from("assets")
      .select("id")
      .eq("id", args.towTruckAssetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!asset) return { ok: false, error: "towTruckAssetId not found for this tenant" };
    return { ok: true };
  },
  async summarize(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("name")
      .eq("id", args.towTruckAssetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    const vehicleName = asset?.name ?? args.towTruckAssetId;
    const route =
      args.origin && args.destination
        ? ` de ${args.origin} para ${args.destination}`
        : args.origin
          ? ` a partir de ${args.origin}`
          : "";
    return `Criar solicitação de guincho com "${vehicleName}"${route}, em ${args.scheduledStartsAt}.`;
  },
  async describeFields(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("name")
      .eq("id", args.towTruckAssetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    const fields: { label: string; value: string }[] = [
      { label: "Guincho", value: asset?.name ?? args.towTruckAssetId ?? "" },
      { label: "Atendimento", value: args.scheduledStartsAt ?? "" },
      { label: "Término estimado", value: args.scheduledEndsAt ?? "" },
    ];
    if (args.origin) fields.push({ label: "Origem", value: args.origin });
    if (args.destination) fields.push({ label: "Destino", value: args.destination });
    return fields;
  },
  resultEntity(_data, _args) {
    return { entityType: "TOWING", displayName: "Solicitação de guincho" };
  },
  async execute(args, _ctx, scope) {
    try {
      const request = await createTowingServiceRequest(scope.db, {
        tenantId: scope.tenantId,
        towTruckAssetId: args.towTruckAssetId!,
        operatorResourceId: args.operatorResourceId ?? null,
        scheduledStartsAt: args.scheduledStartsAt!,
        scheduledEndsAt: args.scheduledEndsAt!,
        origin: args.origin ?? null,
        destination: args.destination ?? null,
        description: args.description ?? null,
        customerOrganizationId: args.customerOrganizationId ?? null,
      });

      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "operation",
        entityId: request.id,
        action: "created",
        metadata: { type: "towing_service_request", source: "shina_agent" },
      });

      return { ok: true, data: request };
    } catch (e) {
      if (e instanceof TowingConflictError) {
        return {
          ok: false,
          error: `O ${e.on === "vehicle" ? "guincho" : "operador"} já está reservado nesse período.`,
        };
      }
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
