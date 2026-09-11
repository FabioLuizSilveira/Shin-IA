import { NextResponse, type NextRequest } from "next/server";
import {
  computeConfigurationDelta,
  resolveOffboardingPlan,
  computePricing,
  type ConfigurationSnapshotForDelta,
} from "@shina/commercial-platform";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

const FLAG = "onboarding.discovery";

interface Body {
  action?: "delta" | "offboarding";
  proposed?: {
    planKey?: string | null;
    planVersionId?: string | null;
    extensions?: string[];
    quotas?: Record<string, number>;
    commitmentPeriodMonths?: number | null;
  };
}

// WAVE 5 — OPERATE / EVOLVE. `delta` compares the tenant's accepted
// CommercialConfiguration against a proposed change and returns the
// deterministic classification (material → new contract; operational →
// reprovision only). `offboarding` returns the retention/data-handling plan
// from the current published policy. Nothing is mutated here.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await isFeatureEnabled(scope, FLAG))) {
    return NextResponse.json({ error: "Discovery não habilitado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const action = body?.action ?? "delta";

  try {
    if (action === "offboarding") {
      return NextResponse.json({ data: await resolveOffboardingPlan(scope.db) });
    }

    // action === "delta"
    const { data: config } = await scope.db
      .from("commercial_configurations")
      .select(
        "plan_id, plan_version_id, extensions, quotas, commitment_period_months, billing_cycle, status",
      )
      .eq("tenant_id", scope.tenantId)
      .in("status", ["accepted", "confirmed"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!config) {
      return NextResponse.json(
        { error: "Nenhuma configuração comercial aceita para comparar" },
        { status: 404 },
      );
    }

    const priceFor = async (
      planVersionId: string | null,
      extensions: string[],
      commitment: number | null,
      billingCycle: "monthly" | "yearly",
      assets: number | null,
    ): Promise<number | null> => {
      if (!planVersionId) return null;
      const { data: pv } = await scope.db
        .from("plan_versions")
        .select("price_cents")
        .eq("id", planVersionId)
        .maybeSingle();
      if (!pv) return null;
      const pricing = await computePricing(scope.db, {
        basePlanPriceCents: pv.price_cents as number,
        billingCycle,
        extensions,
        commitmentPeriodMonths: commitment,
        assetQuantity: assets,
      });
      return pricing.totalMonthlyCents;
    };

    const currentBilling = (config.billing_cycle as "monthly" | "yearly") ?? "monthly";
    const currentQuotas = (config.quotas as Record<string, number>) ?? {};
    const currentExtensions = (config.extensions as string[]) ?? [];

    const [currentPlanRow] = config.plan_id
      ? [(await scope.db.from("plans").select("key").eq("id", config.plan_id).maybeSingle()).data]
      : [null];

    const current: ConfigurationSnapshotForDelta = {
      planKey: (currentPlanRow?.key as string) ?? null,
      planVersionId: (config.plan_version_id as string) ?? null,
      extensions: currentExtensions,
      quotas: currentQuotas,
      commitmentPeriodMonths: config.commitment_period_months,
      totalMonthlyCents: await priceFor(
        config.plan_version_id as string | null,
        currentExtensions,
        config.commitment_period_months,
        currentBilling,
        currentQuotas.assets ?? null,
      ),
    };

    const p = body?.proposed ?? {};
    const proposedExtensions = p.extensions ?? currentExtensions;
    const proposedQuotas = p.quotas ?? currentQuotas;
    const proposedCommitment = p.commitmentPeriodMonths ?? config.commitment_period_months ?? null;
    const proposed: ConfigurationSnapshotForDelta = {
      planKey: p.planKey ?? current.planKey,
      planVersionId: p.planVersionId ?? current.planVersionId,
      extensions: proposedExtensions,
      quotas: proposedQuotas,
      commitmentPeriodMonths: proposedCommitment,
      totalMonthlyCents: await priceFor(
        p.planVersionId ?? current.planVersionId,
        proposedExtensions,
        proposedCommitment,
        currentBilling,
        proposedQuotas.assets ?? null,
      ),
    };

    const delta = computeConfigurationDelta(current, proposed);
    return NextResponse.json({ data: { current, proposed, delta } });
  } catch (err) {
    return internalError(err);
  }
}
