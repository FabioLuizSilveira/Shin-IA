// Agent Runtime Architecture v2, Wave 2 (spec section 14) — a real Model
// Router in the "provider/model resolves from policy, not hardcoded per
// call site" sense, NOT yet a real multi-model comparison (spec section
// 15 is explicit: "não trocar gpt-4o-mini cegamente... medir depois").
// Every tier below resolves to the gateway's own default model today —
// this file's only job right now is to make every call site express
// INTENT ("this is a FAST classification call") instead of a hardcoded
// model string, so a real per-tier policy in a later wave (after the
// Wave 4 benchmark spec section 40 asks for) is a change in ONE place,
// not a grep across the codebase.

export type ModelTier = "FAST" | "STANDARD" | "COMPLEX";

/** Returns the model name for a tier, or undefined to let the AI Gateway
 * use its own configured default (today: every tier is undefined —
 * there is no real differentiation yet, see file header). */
export function resolveModelForTier(_tier: ModelTier): string | undefined {
  return undefined;
}
