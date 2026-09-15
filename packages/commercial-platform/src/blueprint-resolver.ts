import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessProfile } from "./business-profile.js";

// WAVE 2 — DETERMINISTIC blueprint resolution. Same BusinessProfile + same
// rule_version => byte-identical output. No LLM, no randomness, no wall
// clock. The rule set lives in `blueprint_resolver_rules` (one active
// version); nothing here is hardcoded except the fallback when the table is
// unreachable, which is itself explicit and logged via `reasons`.

export interface ResolverProfileInput {
  primaryVertical: string;
  additionalVerticals?: string[];
  answers?: Array<{ questionKey: string; value: unknown }>;
}

export interface RecommendationReason {
  code: string;
  message: string;
  inputs: Record<string, unknown>;
}

export interface BlueprintResolution {
  ruleVersion: number;
  primaryVertical: string;
  baseBlueprintId: string;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  additionalBlueprintIds: string[];
  reasons: RecommendationReason[];
}

interface VerticalRule {
  baseBlueprintId: string;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
}

interface BlueprintResolverRules {
  defaultBlueprintId: string;
  verticals: Record<string, VerticalRule>;
  answerCapabilities: Record<string, { whenTrue: string[] }>;
}

function toProfileInput(p: BusinessProfile | ResolverProfileInput): ResolverProfileInput {
  return {
    primaryVertical: p.primaryVertical,
    additionalVerticals: p.additionalVerticals ?? [],
    answers: p.answers ?? [],
  };
}

function isTrue(value: unknown): boolean {
  return value === true || value === "true" || value === "sim" || value === 1;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export async function loadActiveBlueprintResolverRules(
  db: SupabaseClient,
): Promise<{ ruleVersion: number; rules: BlueprintResolverRules }> {
  const { data, error } = await db
    .from("blueprint_resolver_rules")
    .select("rule_version, rules")
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("no active blueprint_resolver_rules");
  return {
    ruleVersion: data.rule_version as number,
    rules: data.rules as BlueprintResolverRules,
  };
}

/**
 * Resolve the base blueprint + capability set for a business profile.
 * Pure given (profile, rules): callers that need reproducibility can pass a
 * pinned rule set via `resolveBlueprintWithRules`.
 */
export async function resolveBlueprint(
  db: SupabaseClient,
  profile: BusinessProfile | ResolverProfileInput,
): Promise<BlueprintResolution> {
  const { ruleVersion, rules } = await loadActiveBlueprintResolverRules(db);
  return resolveBlueprintWithRules(toProfileInput(profile), ruleVersion, rules);
}

export function resolveBlueprintWithRules(
  profile: ResolverProfileInput,
  ruleVersion: number,
  rules: BlueprintResolverRules,
): BlueprintResolution {
  const reasons: RecommendationReason[] = [];
  const primary = profile.primaryVertical;
  const verticalRule = rules.verticals[primary];

  let baseBlueprintId: string;
  let requiredCapabilities: string[];
  let optionalCapabilities: string[];

  if (verticalRule) {
    baseBlueprintId = verticalRule.baseBlueprintId;
    requiredCapabilities = [...verticalRule.requiredCapabilities];
    optionalCapabilities = [...verticalRule.optionalCapabilities];
    reasons.push({
      code: "VERTICAL_MATCHED",
      message: `Atividade principal "${primary}" → blueprint base "${baseBlueprintId}".`,
      inputs: { primaryVertical: primary, baseBlueprintId },
    });
  } else {
    baseBlueprintId = rules.defaultBlueprintId;
    requiredCapabilities = [];
    optionalCapabilities = [];
    reasons.push({
      code: "VERTICAL_FALLBACK",
      message: `Nenhuma regra para "${primary}"; usando o blueprint genérico "${baseBlueprintId}".`,
      inputs: { primaryVertical: primary, baseBlueprintId },
    });
  }

  // Discovery answers can PROMOTE optional capabilities to required.
  for (const answer of profile.answers ?? []) {
    const mapping = rules.answerCapabilities[answer.questionKey];
    if (mapping && isTrue(answer.value)) {
      for (const cap of mapping.whenTrue) {
        if (!requiredCapabilities.includes(cap)) {
          requiredCapabilities.push(cap);
          optionalCapabilities = optionalCapabilities.filter((c) => c !== cap);
          reasons.push({
            code: "CAPABILITY_FROM_ANSWER",
            message: `Resposta "${answer.questionKey}" tornou a capacidade "${cap}" obrigatória.`,
            inputs: { questionKey: answer.questionKey, capability: cap },
          });
        }
      }
    }
  }

  const additionalVerticals = (profile.additionalVerticals ?? []).filter((v) => v !== primary);
  const additionalBlueprintIds = uniqueSorted(
    additionalVerticals.map((v) => rules.verticals[v]?.baseBlueprintId ?? rules.defaultBlueprintId),
  );
  if (additionalBlueprintIds.length > 0) {
    reasons.push({
      code: "ADDITIONAL_VERTICALS",
      message: `Atividades adicionais mapeadas para: ${additionalBlueprintIds.join(", ")}.`,
      inputs: { additionalVerticals: profile.additionalVerticals, additionalBlueprintIds },
    });
  }

  // WAVE 2 (Multi-Operation Business Architecture v2) — a tenant running
  // several operations simultaneously needs the union of every operation's
  // required/optional capabilities, not just the primary one's. Merged and
  // deduplicated here (spec section 29: "Capabilities compartilhadas são
  // deduplicadas") rather than left as a bare list of extra blueprint ids.
  for (const vertical of additionalVerticals) {
    const rule = rules.verticals[vertical];
    if (!rule) continue;
    const newRequired = rule.requiredCapabilities.filter((c) => !requiredCapabilities.includes(c));
    if (newRequired.length > 0) {
      requiredCapabilities.push(...newRequired);
      reasons.push({
        code: "CAPABILITY_FROM_ADDITIONAL_VERTICAL",
        message: `Atividade adicional "${vertical}" acrescentou as capacidades: ${newRequired.join(", ")}.`,
        inputs: { vertical, capabilities: newRequired },
      });
    }
    for (const c of rule.optionalCapabilities) {
      if (!requiredCapabilities.includes(c) && !optionalCapabilities.includes(c)) {
        optionalCapabilities.push(c);
      }
    }
  }

  return {
    ruleVersion,
    primaryVertical: primary,
    baseBlueprintId,
    requiredCapabilities: uniqueSorted(requiredCapabilities),
    optionalCapabilities: uniqueSorted(
      optionalCapabilities.filter((c) => !requiredCapabilities.includes(c)),
    ),
    additionalBlueprintIds,
    reasons,
  };
}
