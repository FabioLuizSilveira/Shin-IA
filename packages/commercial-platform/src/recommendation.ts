import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessProfile } from "./business-profile.js";
import {
  resolveBlueprint,
  type BlueprintResolution,
  type RecommendationReason,
  type ResolverProfileInput,
} from "./blueprint-resolver.js";
import { resolvePlan, type PlanResolution } from "./plan-resolver.js";

// WAVE 2 — the composed, EXPLAINABLE recommendation. `reasons` is assembled
// only from rule outputs (blueprint + plan resolvers, both deterministic) —
// never LLM free-text. The recommendation is a proposal: it resolves the
// concrete published plan_version for the recommended plan key and the
// contract template implied by the vertical, but it commits nothing.

export interface RecommendedPlan {
  planKey: string;
  planId: string | null;
  planVersionId: string | null;
  priceCents: number | null;
  includedFeatures: string[];
}

export interface OnboardingRecommendation {
  blueprint: BlueprintResolution;
  plan: RecommendedPlan;
  recommendedExtensions: string[];
  optionalAddOns: string[];
  contractTemplateKey: string | null;
  retentionSummary: string | null;
  reasons: RecommendationReason[];
}

async function resolvePublishedPlanVersion(
  db: SupabaseClient,
  planKey: string,
): Promise<RecommendedPlan> {
  const { data: plan } = await db
    .from("plans")
    .select("id")
    .eq("product", "platform")
    .eq("key", planKey)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) {
    return { planKey, planId: null, planVersionId: null, priceCents: null, includedFeatures: [] };
  }
  const { data: version } = await db
    .from("plan_versions")
    .select("id, price_cents, included_features")
    .eq("plan_id", plan.id)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    planKey,
    planId: plan.id as string,
    planVersionId: (version?.id as string) ?? null,
    priceCents: (version?.price_cents as number) ?? null,
    includedFeatures: (version?.included_features as string[]) ?? [],
  };
}

export async function buildOnboardingRecommendation(
  db: SupabaseClient,
  profile: BusinessProfile | ResolverProfileInput,
): Promise<OnboardingRecommendation> {
  const blueprint = await resolveBlueprint(db, profile);
  const plan: PlanResolution = await resolvePlan(db, profile, blueprint);

  const [recommendedPlan, verticalRow, retention] = await Promise.all([
    resolvePublishedPlanVersion(db, plan.recommendedPlanKey),
    db
      .from("verticals")
      .select("contract_template_key")
      .eq("key", blueprint.primaryVertical)
      .maybeSingle(),
    db
      .from("retention_policies")
      .select("summary")
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const reasons: RecommendationReason[] = [...blueprint.reasons, ...plan.reasons];
  if (!recommendedPlan.planVersionId) {
    reasons.push({
      code: "PLAN_VERSION_UNRESOLVED",
      message: `Nenhuma versão publicada encontrada para o plano "${plan.recommendedPlanKey}".`,
      inputs: { planKey: plan.recommendedPlanKey },
    });
  }

  return {
    blueprint,
    plan: recommendedPlan,
    recommendedExtensions: plan.recommendedExtensions,
    optionalAddOns: plan.optionalAddOns,
    contractTemplateKey: (verticalRow.data?.contract_template_key as string) ?? null,
    retentionSummary: (retention.data?.summary as string) ?? null,
    reasons,
  };
}
