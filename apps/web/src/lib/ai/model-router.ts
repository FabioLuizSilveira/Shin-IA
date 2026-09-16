// Agent Runtime Architecture v2, Wave 4 (spec sections 14-15, 40) -- a
// real per-tier model policy, gated behind measurement rather than a
// blind swap (spec section 15: "não trocar gpt-4o-mini cegamente...
// medir depois"). The Shinã Agent's tool-calling ("messages") path is
// OpenAI-only, a fixed product decision documented in
// packages/ai-gateway/src/gateway.ts's file header -- Wave 4 does not
// change that. What it DOES change: FAST/STANDARD keep the proven
// default (gpt-4o-mini), COMPLEX moves to a real, more capable model
// (gpt-4o) -- backed by a real cost policy row (migration
// 20261006000000) so it bills correctly instead of silently running
// free (a gap a real audit of the gateway found: an unpriced model
// skips both the pre-check and the debit rather than failing loud).
const MODEL_BY_TIER: Record<ModelTier, string> = {
  FAST: "gpt-4o-mini",
  STANDARD: "gpt-4o-mini",
  COMPLEX: "gpt-4o",
};

export type ModelTier = "FAST" | "STANDARD" | "COMPLEX";

/** Returns the real model name for a tier -- no longer a stub. */
export function resolveModelForTier(tier: ModelTier): string | undefined {
  return MODEL_BY_TIER[tier];
}

/** Wave 4's actual routing decision -- grounded in the Capability
 * Router's own `isFallback` flag (capability-router.ts), NOT a guess
 * from raw candidate counts. An earlier version of this function
 * compared candidatesAfterFilter < candidatesBeforeFilter and a real
 * live test caught it as wrong: an ASSET-classified query that fell
 * back to the unannotated set STILL shows a smaller "after" count, only
 * because the fallback excludes the 3 ORGANIZATION-annotated tools --
 * that's not real narrowing toward ASSET, it's an unrelated domain's
 * tools being filtered out. `isFallback` is the router's own honest
 * signal for "did I actually resolve this to a domain with real
 * coverage, or did I give up and hand back the wide set."
 *
 * - `forced`: exactly ONE tool, no real choice to make -- FAST, the
 *   cheapest, least ambiguous case.
 * - real domain match, not fallback: the catalog IS meaningfully
 *   smaller -- STANDARD, the same tier gpt-4o-mini already proved 4/4
 *   reliable on (Wave 2's create_organization case).
 * - `isFallback`: LOW confidence, or a domain the Tool Registry hasn't
 *   migrated yet -- the model still faces the full, wide, ambiguous
 *   catalog. COMPLEX spends more to compensate for the ambiguity
 *   routing couldn't resolve -- see this wave's report for the live
 *   measurement of how much that actually helps.
 *
 * Only called when agent.dynamic_tool_routing is already on (same
 * pilot-only gate as the rest of Wave 2/3) -- outside that flag, every
 * call keeps using the gateway's bare default, unchanged. */
export function resolveAgentModelTier(filter: { forced: boolean; isFallback: boolean }): ModelTier {
  if (filter.forced) return "FAST";
  if (!filter.isFallback) return "STANDARD";
  return "COMPLEX";
}
