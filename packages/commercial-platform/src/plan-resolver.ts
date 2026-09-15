import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessProfile } from "./business-profile.js";
import type {
  BlueprintResolution,
  RecommendationReason,
  ResolverProfileInput,
} from "./blueprint-resolver.js";

// WAVE 2 — DETERMINISTIC plan recommendation. Every threshold / faixa /
// per-vertical floor lives in `plan_resolver_rules` (one active version) —
// the wizard renders the outcome, it never re-implements the arithmetic.
// The recommended plan is the HIGHEST-ranked plan implied by: the asset-count
// faixa, the per-vertical floor, and every capability that carries a minimum
// plan. Same profile + rule_version => same plan.

interface PlanResolverRules {
  planRank: string[];
  defaultPlanKey: string;
  assetThresholds: Array<{ maxAssets: number | null; planKey: string }>;
  capabilityMinPlan: Record<string, string>;
  verticalFloor: Record<string, string>;
  extensionsByCapability: Record<string, string[]>;
  optionalAddOnsByVertical: Record<string, string[]>;
}

export interface PlanResolution {
  ruleVersion: number;
  recommendedPlanKey: string;
  recommendedExtensions: string[];
  optionalAddOns: string[];
  reasons: RecommendationReason[];
}

export async function loadActivePlanResolverRules(
  db: SupabaseClient,
): Promise<{ ruleVersion: number; rules: PlanResolverRules }> {
  const { data, error } = await db
    .from("plan_resolver_rules")
    .select("rule_version, rules")
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("no active plan_resolver_rules");
  return { ruleVersion: data.rule_version as number, rules: data.rules as PlanResolverRules };
}

/** Asset count comes from the profile field or, failing that, the
 *  `asset_quantity` discovery answer. */
function readAssetQuantity(profile: BusinessProfile | ResolverProfileInput): number | null {
  if ("assetQuantity" in profile && typeof profile.assetQuantity === "number") {
    return profile.assetQuantity;
  }
  const answer = (profile.answers ?? []).find((a) => a.questionKey === "asset_quantity");
  if (answer && typeof answer.value === "number") return answer.value;
  if (answer && typeof answer.value === "string" && answer.value.trim() !== "") {
    const n = Number(answer.value);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function higherPlan(rank: string[], a: string, b: string): string {
  return rank.indexOf(a) >= rank.indexOf(b) ? a : b;
}

export async function resolvePlan(
  db: SupabaseClient,
  profile: BusinessProfile | ResolverProfileInput,
  blueprint: BlueprintResolution,
): Promise<PlanResolution> {
  const { ruleVersion, rules } = await loadActivePlanResolverRules(db);
  return resolvePlanWithRules(profile, blueprint, ruleVersion, rules);
}

export function resolvePlanWithRules(
  profile: BusinessProfile | ResolverProfileInput,
  blueprint: BlueprintResolution,
  ruleVersion: number,
  rules: PlanResolverRules,
): PlanResolution {
  const reasons: RecommendationReason[] = [];
  const rank = rules.planRank;
  const assetQuantity = readAssetQuantity(profile);

  let plan = rules.defaultPlanKey;

  // 1. asset-count faixa
  if (assetQuantity !== null) {
    const faixa = rules.assetThresholds.find(
      (t) => t.maxAssets === null || assetQuantity <= t.maxAssets,
    );
    if (faixa) {
      plan = higherPlan(rank, plan, faixa.planKey);
      reasons.push({
        code: "PLAN_BY_ASSET_COUNT",
        message: `${assetQuantity} ativos → faixa "${faixa.planKey}".`,
        inputs: { assetQuantity, maxAssets: faixa.maxAssets, planKey: faixa.planKey },
      });
    }
  }

  // 2. per-vertical floor — WAVE 2 (Multi-Operation Business Architecture
  // v2): every operation the tenant runs can impose its own floor, not just
  // the primary one. A rental-motorcycles primary (starter) with guincho as
  // an additional activity must still be floored at guincho's professional
  // requirement.
  const allVerticals = [
    blueprint.primaryVertical,
    ...("additionalVerticals" in profile ? (profile.additionalVerticals ?? []) : []),
  ];
  for (const vertical of allVerticals) {
    const floor = rules.verticalFloor[vertical];
    if (!floor) continue;
    const before = plan;
    plan = higherPlan(rank, plan, floor);
    if (plan !== before || plan === floor) {
      reasons.push({
        code: "PLAN_FLOOR_VERTICAL",
        message: `A atividade "${vertical}" exige no mínimo o plano "${floor}".`,
        inputs: { vertical, floorPlanKey: floor },
      });
    }
  }

  // 3. capability minimums
  const allCaps = [...blueprint.requiredCapabilities, ...blueprint.optionalCapabilities];
  for (const [cap, minPlan] of Object.entries(rules.capabilityMinPlan)) {
    if (blueprint.requiredCapabilities.includes(cap)) {
      const before = plan;
      plan = higherPlan(rank, plan, minPlan);
      if (plan !== before) {
        reasons.push({
          code: "PLAN_BY_CAPABILITY",
          message: `A capacidade "${cap}" exige o plano "${minPlan}".`,
          inputs: { capability: cap, minPlanKey: minPlan },
        });
      }
    }
  }

  // 4. recommended extensions (from required capabilities only)
  const recommendedExtensions = [
    ...new Set(
      blueprint.requiredCapabilities.flatMap((cap) => rules.extensionsByCapability[cap] ?? []),
    ),
  ].sort();
  if (recommendedExtensions.length > 0) {
    reasons.push({
      code: "EXTENSIONS_RECOMMENDED",
      message: `Extensões sugeridas pelas capacidades obrigatórias: ${recommendedExtensions.join(", ")}.`,
      inputs: { fromCapabilities: blueprint.requiredCapabilities, recommendedExtensions },
    });
  }

  // 5. optional add-ons (informational, never auto-selected) — union across
  // every selected vertical, not just the primary one.
  const optionalAddOns = [
    ...new Set(allVerticals.flatMap((v) => rules.optionalAddOnsByVertical[v] ?? [])),
  ].sort();

  void allCaps;
  return { ruleVersion, recommendedPlanKey: plan, recommendedExtensions, optionalAddOns, reasons };
}
