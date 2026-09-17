import type { AgentMutationTool } from "../types";
import {
  checkRentalAvailability,
  findApplicableRentalRate,
  calculateRentalPrice,
  createRentalPricingSnapshot,
  createRental,
  createRentalContract,
  RentalConflictError,
} from "@/lib/rental/rental-service";
import { logActivity } from "@/lib/activity-log";

interface Args {
  assetId?: string;
  scheduledStartsAt?: string;
  scheduledEndsAt?: string;
  customerOrganizationId?: string;
}

// Agent Runtime v3, Wave 3 -- the actual EXECUTE step for the CREATE_RENTAL
// goal (goal-resolver.ts), wired to Wave 2.5's real rental-service.ts.
// Never computes price itself -- calculateRentalPrice() is the same pure,
// deterministic function the domain layer already proved live. validate()
// re-checks availability and that a rate exists BEFORE a plan is ever
// created (spec section 25: show a real summary, never propose something
// that would fail); execute() re-checks again inside createRental() (the
// real GiST-backed guard) since availability can change between propose
// and confirm.
export const createRentalTool: AgentMutationTool<Args> = {
  name: "create_rental",
  description:
    "Cria uma locação (aluguel) de um veículo para um cliente, em um período, com preço calculado automaticamente a partir da tarifa real do tenant.",
  inputSchema: {
    type: "object",
    properties: {
      assetId: { type: "string", description: "UUID do veículo" },
      scheduledStartsAt: { type: "string", description: "Data/hora de retirada, ISO 8601" },
      scheduledEndsAt: { type: "string", description: "Data/hora de devolução, ISO 8601" },
      customerOrganizationId: { type: "string", description: "UUID do cliente" },
    },
    required: ["assetId", "scheduledStartsAt", "scheduledEndsAt", "customerOrganizationId"],
  },
  riskLevel: "LOW_RISK_WRITE",
  requiredPermission: "tenant.rentals.create",
  requiredFeature: "agent.actions.rentals",
  domain: "RENTAL",
  intents: ["CREATE"],
  async validate(args, _ctx, scope) {
    if (
      !args.assetId ||
      !args.scheduledStartsAt ||
      !args.scheduledEndsAt ||
      !args.customerOrganizationId
    ) {
      return {
        ok: false,
        error:
          "assetId, scheduledStartsAt, scheduledEndsAt and customerOrganizationId are required",
      };
    }
    if (new Date(args.scheduledStartsAt) >= new Date(args.scheduledEndsAt)) {
      return { ok: false, error: "scheduledStartsAt must be before scheduledEndsAt" };
    }

    const { data: org } = await scope.db
      .from("organizations")
      .select("id")
      .eq("id", args.customerOrganizationId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!org) return { ok: false, error: "customerOrganizationId not found for this tenant" };

    const { data: asset } = await scope.db
      .from("assets")
      .select("id")
      .eq("id", args.assetId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!asset) return { ok: false, error: "assetId not found for this tenant" };

    const availability = await checkRentalAvailability(scope.db, {
      tenantId: scope.tenantId,
      assetId: args.assetId,
      startsAt: args.scheduledStartsAt,
      endsAt: args.scheduledEndsAt,
    });
    if (!availability.available) {
      return { ok: false, error: "Este veículo já está reservado nesse período." };
    }

    const rate = await findApplicableRentalRate(scope.db, {
      tenantId: scope.tenantId,
      assetId: args.assetId,
    });
    if (!rate) {
      return { ok: false, error: "Não há tarifa cadastrada para este veículo." };
    }

    return { ok: true };
  },
  async summarize(args, _ctx, scope) {
    const rate = await findApplicableRentalRate(scope.db, {
      tenantId: scope.tenantId,
      assetId: args.assetId!,
    });
    const price = calculateRentalPrice(rate!, args.scheduledStartsAt!, args.scheduledEndsAt!);
    const [{ data: asset }, { data: org }] = await Promise.all([
      scope.db.from("assets").select("name").eq("id", args.assetId).maybeSingle(),
      scope.db
        .from("organizations")
        .select("name")
        .eq("id", args.customerOrganizationId)
        .maybeSingle(),
    ]);
    const total = (price.totalCents / 100).toFixed(2);
    return `Criar locação de "${asset?.name ?? args.assetId}" para "${org?.name ?? args.customerOrganizationId}", de ${args.scheduledStartsAt} até ${args.scheduledEndsAt}. Valor: ${price.breakdown} = ${price.currency} ${total}.`;
  },
  async describeFields(args, _ctx, scope) {
    const rate = await findApplicableRentalRate(scope.db, {
      tenantId: scope.tenantId,
      assetId: args.assetId!,
    });
    const price = calculateRentalPrice(rate!, args.scheduledStartsAt!, args.scheduledEndsAt!);
    const [{ data: asset }, { data: org }] = await Promise.all([
      scope.db.from("assets").select("name").eq("id", args.assetId).maybeSingle(),
      scope.db
        .from("organizations")
        .select("name")
        .eq("id", args.customerOrganizationId)
        .maybeSingle(),
    ]);
    return [
      { label: "Cliente", value: org?.name ?? args.customerOrganizationId ?? "" },
      { label: "Veículo", value: asset?.name ?? args.assetId ?? "" },
      { label: "Retirada", value: args.scheduledStartsAt ?? "" },
      { label: "Devolução", value: args.scheduledEndsAt ?? "" },
      { label: "Preço", value: price.breakdown },
      { label: "Total", value: `${price.currency} ${(price.totalCents / 100).toFixed(2)}` },
    ];
  },
  // No resultEntity() -- a rental produces BOTH an operation and a
  // contract, and entity-context.ts's EntityRelation enum (Wave 1) has
  // no slot for "the rental just created" specifically. Deferred rather
  // than forcing a mismatched relation (e.g. CURRENT_CONTRACT pointing
  // at the operation id) -- not required for this wave's canonical flow.
  async execute(args, _ctx, scope) {
    try {
      const rate = await findApplicableRentalRate(scope.db, {
        tenantId: scope.tenantId,
        assetId: args.assetId!,
      });
      if (!rate) return { ok: false, error: "Não há tarifa cadastrada para este veículo." };

      const price = calculateRentalPrice(rate, args.scheduledStartsAt!, args.scheduledEndsAt!);

      const snapshot = await createRentalPricingSnapshot(scope.db, {
        tenantId: scope.tenantId,
        assetId: args.assetId!,
        startsAt: args.scheduledStartsAt!,
        endsAt: args.scheduledEndsAt!,
        rateId: rate.id,
        subtotalCents: price.subtotalCents,
        totalCents: price.totalCents,
        currency: price.currency,
      });

      const rental = await createRental(scope.db, {
        tenantId: scope.tenantId,
        assetId: args.assetId!,
        customerOrganizationId: args.customerOrganizationId,
        scheduledStartsAt: args.scheduledStartsAt!,
        scheduledEndsAt: args.scheduledEndsAt!,
        pricingSnapshotId: snapshot.id,
      });

      const contract = await createRentalContract(scope.db, {
        tenantId: scope.tenantId,
        organizationId: args.customerOrganizationId!,
        valueAmount: price.totalCents / 100,
        valueCurrency: price.currency,
        periodStartsAt: args.scheduledStartsAt!,
        periodEndsAt: args.scheduledEndsAt!,
        rentalOperationId: rental.id,
      });

      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "operation",
        entityId: rental.id,
        action: "created",
        metadata: { type: "vehicle_rental", contractId: contract.id, source: "shina_agent" },
      });

      return { ok: true, data: { ...rental, contract } };
    } catch (e) {
      if (e instanceof RentalConflictError) {
        return {
          ok: false,
          error: "O veículo já foi reservado nesse período por outra solicitação.",
        };
      }
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
