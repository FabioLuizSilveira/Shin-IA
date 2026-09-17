import type { AgentMutationTool } from "../types";
import { createTrip, TripConflictError } from "@/lib/transport/trip-service";
import { logActivity } from "@/lib/activity-log";

interface Args {
  vehicleAssetId?: string;
  scheduledStartsAt?: string;
  scheduledEndsAt?: string;
  passengerCount?: number;
  customerOrganizationId?: string;
  driverResourceId?: string;
}

// Agent Runtime v3, Wave 2 -- wraps createTrip() (apps/web/src/lib/
// transport/trip-service.ts), a real, already-built, conflict-checked
// domain service that had ZERO callers anywhere in the app before this
// (confirmed by a real grep audit). Never a parallel implementation of
// "book a passenger trip" -- the agent's execute() calls the exact same
// function a real dispatcher route would call, once one exists.
export const createTransportRequestTool: AgentMutationTool<Args> = {
  name: "create_transport_request",
  description:
    "Cria uma solicitação de transporte de passageiros (ônibus/van) para um veículo, período e (opcionalmente) cliente e número de passageiros.",
  inputSchema: {
    type: "object",
    properties: {
      vehicleAssetId: { type: "string", description: "UUID do veículo (ônibus/van)" },
      scheduledStartsAt: { type: "string", description: "Data/hora de partida, ISO 8601" },
      scheduledEndsAt: { type: "string", description: "Data/hora de retorno, ISO 8601" },
      passengerCount: { type: "number", description: "Número de passageiros, opcional" },
      customerOrganizationId: { type: "string", description: "UUID do cliente, opcional" },
      driverResourceId: { type: "string", description: "UUID do motorista/recurso, opcional" },
    },
    required: ["vehicleAssetId", "scheduledStartsAt", "scheduledEndsAt"],
  },
  riskLevel: "LOW_RISK_WRITE",
  requiredPermission: "tenant.trips.create",
  requiredFeature: "agent.actions.transport",
  domain: "PASSENGER_TRANSPORT",
  intents: ["CREATE"],
  async validate(args, _ctx, scope) {
    if (!args.vehicleAssetId || !args.scheduledStartsAt || !args.scheduledEndsAt) {
      return {
        ok: false,
        error: "vehicleAssetId, scheduledStartsAt and scheduledEndsAt are required",
      };
    }
    if (new Date(args.scheduledStartsAt) >= new Date(args.scheduledEndsAt)) {
      return { ok: false, error: "scheduledStartsAt must be before scheduledEndsAt" };
    }
    const { data: asset } = await scope.db
      .from("assets")
      .select("id")
      .eq("id", args.vehicleAssetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!asset) return { ok: false, error: "vehicleAssetId not found for this tenant" };
    return { ok: true };
  },
  async summarize(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("name")
      .eq("id", args.vehicleAssetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    const vehicleName = asset?.name ?? args.vehicleAssetId;
    const passengers = args.passengerCount ? ` para ${args.passengerCount} passageiros` : "";
    return `Criar transporte de passageiros com "${vehicleName}"${passengers}, de ${args.scheduledStartsAt} até ${args.scheduledEndsAt}.`;
  },
  async describeFields(args, _ctx, scope) {
    const { data: asset } = await scope.db
      .from("assets")
      .select("name")
      .eq("id", args.vehicleAssetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    const fields: { label: string; value: string }[] = [
      { label: "Veículo", value: asset?.name ?? args.vehicleAssetId ?? "" },
      { label: "Partida", value: args.scheduledStartsAt ?? "" },
      { label: "Retorno", value: args.scheduledEndsAt ?? "" },
    ];
    if (args.passengerCount)
      fields.push({ label: "Passageiros", value: String(args.passengerCount) });
    return fields;
  },
  resultEntity(_data, _args) {
    return { entityType: "PASSENGER_TRANSPORT", displayName: "Viagem de transporte" };
  },
  async execute(args, _ctx, scope) {
    try {
      const trip = await createTrip(scope.db, {
        tenantId: scope.tenantId,
        vehicleAssetId: args.vehicleAssetId!,
        driverResourceId: args.driverResourceId ?? null,
        scheduledStartsAt: args.scheduledStartsAt!,
        scheduledEndsAt: args.scheduledEndsAt!,
        customerOrganizationId: args.customerOrganizationId ?? null,
        passengerCount: args.passengerCount ?? null,
      });

      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "operation",
        entityId: trip.id,
        action: "created",
        metadata: { type: "passenger_trip", source: "shina_agent" },
      });

      return { ok: true, data: trip };
    } catch (e) {
      if (e instanceof TripConflictError) {
        return {
          ok: false,
          error: `O ${e.on === "vehicle" ? "veículo" : "motorista"} já está reservado nesse período.`,
        };
      }
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
