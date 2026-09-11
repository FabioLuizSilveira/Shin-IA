import { NextResponse, type NextRequest } from "next/server";
import {
  computePricing,
  composeOnboardingContract,
  freezeOnboardingContract,
  resolveContractExecutionMode,
  resolveRequiredContract,
  resolveCurrentRetentionPolicy,
  type ComposeInput,
} from "@shina/commercial-platform";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { logActivity } from "@/lib/activity-log";
import { ONBOARDING_AUDIT_EVENTS, newCorrelationId } from "@/lib/audit-event";

export const dynamic = "force-dynamic";

const FLAG = "onboarding.discovery";

interface Body {
  action?: "preview" | "freeze";
  commercialConfigurationId?: string;
  representative?: {
    shinaName?: string;
    shinaRole?: string;
    tenantName?: string;
    tenantRole?: string;
  };
  vigencia?: string;
  extraTerms?: Record<string, string>;
  allowTemplatePlaceholders?: boolean;
  correlationId?: string;
}

function reais(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

// WAVE 3 — COMPOSE + FREEZE the onboarding contract (legal body from
// contract_versions, unchanged + a filled commercial annex). `preview`
// returns the composed document + readiness gate; `freeze` seals it with a
// content hash into an immutable snapshot. Nothing is provisioned or sent to
// a signature provider here — that is Wave 4.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await isFeatureEnabled(scope, FLAG))) {
    return NextResponse.json({ error: "Discovery não habilitado" }, { status: 403 });
  }
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Sessão somente leitura" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const action = body?.action ?? "preview";
  if (!body?.commercialConfigurationId) {
    return NextResponse.json({ error: "commercialConfigurationId é obrigatório" }, { status: 422 });
  }

  try {
    const { data: config, error: cfgError } = await scope.db
      .from("commercial_configurations")
      .select(
        "id, tenant_id, business_profile_id, plan_id, plan_version_id, extensions, quotas, commitment_period_months, billing_cycle, status",
      )
      .eq("id", body.commercialConfigurationId)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (cfgError) return internalError(cfgError);
    if (!config)
      return NextResponse.json({ error: "Configuração não encontrada" }, { status: 404 });
    if (config.status === "accepted" || config.status === "superseded") {
      return NextResponse.json(
        { error: `Configuração "${config.status}" não pode gerar novo contrato` },
        { status: 409 },
      );
    }

    const contractVersion = await resolveRequiredContract(scope.db, "platform");

    let basePlanPriceCents = 0;
    let planName = "";
    let includedFeatures: string[] = [];
    if (config.plan_version_id) {
      const { data: pv } = await scope.db
        .from("plan_versions")
        .select("name, price_cents, included_features")
        .eq("id", config.plan_version_id)
        .maybeSingle();
      basePlanPriceCents = (pv?.price_cents as number) ?? 0;
      planName = (pv?.name as string) ?? "";
      includedFeatures = (pv?.included_features as string[]) ?? [];
    }

    const extensions = (config.extensions as string[]) ?? [];
    const quotas = (config.quotas as Record<string, number>) ?? {};
    const billingCycle = (config.billing_cycle as "monthly" | "yearly") ?? "monthly";

    const pricing = await computePricing(scope.db, {
      basePlanPriceCents,
      billingCycle,
      extensions,
      commitmentPeriodMonths: config.commitment_period_months,
      assetQuantity: quotas.assets ?? null,
    });

    let retentionSummary = "";
    try {
      retentionSummary = (await resolveCurrentRetentionPolicy(scope.db)).summary ?? "";
    } catch {
      retentionSummary = "";
    }

    const rep = body.representative ?? {};
    const extra = body.extraTerms ?? {};
    const vars: Record<string, string | number> = {
      planoNome: planName || "—",
      mensalidadeReais: reais(pricing.totalMonthlyCents),
      cicloCobranca: billingCycle === "yearly" ? "Anual" : "Mensal",
      vigencia: body.vigencia ?? "12 meses, renovável automaticamente",
      permanenciaMeses: config.commitment_period_months ?? 0,
      multaRescisao:
        extra.multaRescisao ?? "50% das mensalidades restantes do período de permanência",
      setup: extra.setup ?? "Isento",
      reajuste: extra.reajuste ?? "Anual pelo IPCA",
      renovacao: extra.renovacao ?? "Automática por períodos iguais",
      suporte: extra.suporte ?? "Horário comercial, canal via plataforma",
      usuariosIncluidos: quotas.users ?? "Conforme plano",
      ativosIncluidos: quotas.assets ?? "Conforme plano",
      modulosIncluidos: includedFeatures.join(", ") || "Conforme plano",
      extensoesContratadas: extensions.join(", ") || "Nenhuma",
      aiCredits: quotas.aiCredits ?? 0,
      armazenamentoGb: quotas.storageGb ?? 0,
      representanteShinaNome: rep.shinaName ?? "",
      representanteShinaCargo: rep.shinaRole ?? "",
      representanteTenantNome: rep.tenantName ?? "",
      representanteTenantCargo: rep.tenantRole ?? "",
      retencaoResumo: retentionSummary || "Conforme Política de Retenção da Shinã",
    };

    // Execution mode is driven by the COMMERCIAL terms (commitment length),
    // not by contract_versions.material_change — the latter means "existing
    // tenants must re-accept this text", a different concern from "this new
    // deal needs a wet signature".
    const executionMode = resolveContractExecutionMode({
      commitmentPeriodMonths: config.commitment_period_months,
    });

    const composeInput: ComposeInput = {
      tenantId: scope.tenantId,
      commercialConfigurationId: config.id,
      businessProfileId: config.business_profile_id,
      contractVersionId: contractVersion.id,
      compositionTemplateKey: "platform_commercial_annex",
      executionMode,
      pricingVersion: pricing.pricingVersion,
      pricing: pricing as unknown as Record<string, unknown>,
      vars,
      createdBy: scope.userId,
    };
    const correlationId = body.correlationId ?? newCorrelationId();

    if (action === "preview") {
      const composed = await composeOnboardingContract(scope.db, composeInput);
      return NextResponse.json({
        data: { correlationId, executionMode, pricing, composed },
      });
    }

    // action === "freeze"
    const frozen = await freezeOnboardingContract(scope.db, {
      ...composeInput,
      allowTemplatePlaceholders: body.allowTemplatePlaceholders ?? false,
    });
    await logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      actorType: "tenant_user",
      correlationId,
      entityType: "onboarding_contract",
      entityId: frozen.id,
      action: ONBOARDING_AUDIT_EVENTS.CONTRACT_SNAPSHOT_FROZEN,
      metadata: {
        commercialConfigurationId: config.id,
        contentHash: frozen.contentHash,
        executionMode,
        pricingVersion: pricing.pricingVersion,
      },
    });
    return NextResponse.json({ data: { correlationId, executionMode, frozen } });
  } catch (err) {
    if (
      err instanceof Error &&
      /not ready to freeze|unresolved placeholder|already exists/.test(err.message)
    ) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return internalError(err);
  }
}
