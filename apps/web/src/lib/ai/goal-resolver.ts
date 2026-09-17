// Agent Runtime v3, Wave 2 ("Workflow Orchestration") — Goal Resolver
// (spec sections 4-6): maps a user message to an operational GOAL when
// there's a real multi-step process behind it, distinct from the
// per-message Intent Router (v2's intent-router.ts classifies WHAT this
// message means; this classifies WHAT the user is trying to accomplish
// across the whole conversation). Deliberately starts with only the two
// domains this wave validates the orchestrator against — per explicit
// user decision, CREATE_RENTAL is Wave 2.5+ territory (the real Rental
// domain doesn't exist yet, see project_agent_runtime_v3 memory).

export type GoalType = "CREATE_TOWING_REQUEST" | "CREATE_TRANSPORT_REQUEST";

interface GoalRule {
  type: GoalType;
  pattern: RegExp;
}

// Tight-ish patterns (not the wide-gap style) — same lesson Wave 5 v2
// learned the hard way: keep the trigger word close to its real meaning
// rather than letting arbitrary text between words cause a false match.
const GOAL_RULES: GoalRule[] = [
  {
    type: "CREATE_TOWING_REQUEST",
    pattern: /\b(guincho|reboqu\w*|rebocar)\b/i,
  },
  {
    // No leading \b before [oô]nibus — "ô" isn't a \w character in a
    // plain JS regex (same lesson intent-router.ts's "onde está" fix
    // learned in Wave 6 v2), so \b right before it can never match. The
    // trailing \b after "nibus"/"van"/"passageiros" is fine (those end
    // in plain ASCII letters).
    type: "CREATE_TRANSPORT_REQUEST",
    pattern:
      /([oô]nibus|micro[- ]?[oô]nibus|\bvan\b|transporte\s+de\s+passageiros|\d+\s*passageiros)\b/i,
  },
];

/** Tier-1 deterministic goal classification — free, instant. Returns
 * null when nothing matches (the caller either falls through to normal
 * per-message handling, or — once a goal is already ACTIVE for this
 * conversation — keeps using that existing goal, since a follow-up
 * message like "o Mobi" or "amanhã às 9" won't re-trigger these
 * keywords at all, matching spec section 6: "Intent ≠ Goal"). */
export function resolveGoalType(text: string): GoalType | null {
  for (const rule of GOAL_RULES) {
    if (rule.pattern.test(text)) return rule.type;
  }
  return null;
}

export interface GoalRequirementSpec {
  key: string;
  required: boolean;
  /** pt-BR label used when asking the user for this field. */
  label: string;
  /** Optional guidance for HOW the model should resolve this field when
   * it isn't a plain text-extractable value (e.g. an asset id needs a
   * real search, never a guess) — injected into the context note
   * alongside the missing-field label. */
  hint?: string;
  /** When set, ASK_USER for this field forces this exact tool via
   * tool_choice (structural, not just the text hint above) — live-
   * verified necessary: a text-only hint to "call list_assets" was
   * ignored by gpt-4o-mini, which instead explored unrelated tools
   * (get_deep_link with hallucinated args) until hitting the
   * duplicate-call guard. Forcing the search on turn 0 costs nothing
   * when it's redundant (the model can still ask a clarifying question
   * afterward) and fixes the case where it matters. */
  searchTool?: string;
}

// Slot schema per goal — mirrors each real domain service's actual input
// shape (CreateTripInput/CreateTowingServiceRequestInput in
// apps/web/src/lib/transport/*.ts) so the orchestrator never invents a
// requirement the domain service doesn't really have. vehicleAssetId/
// towTruckAssetId are marked required but are NEVER filled by text
// extraction (spec section 9/15): they're resolved by the model calling
// the existing, real list_assets tool and the user picking — the
// orchestrator's job is only to know it's still missing, not to invent
// a parallel asset-search mechanism.
export const GOAL_REQUIREMENTS: Record<GoalType, GoalRequirementSpec[]> = {
  CREATE_TRANSPORT_REQUEST: [
    {
      key: "vehicleAssetId",
      required: true,
      label: "o veículo (ônibus/van)",
      hint: "chame list_assets (category: vehicle, query: ônibus/van) para encontrar opções elegíveis e pergunte ao usuário qual prefere — nunca escolha sozinho se houver mais de uma opção",
      searchTool: "list_assets",
    },
    { key: "scheduledStartsAt", required: true, label: "a data/hora de partida" },
    { key: "scheduledEndsAt", required: true, label: "a data/hora de retorno" },
    { key: "passengerCount", required: false, label: "o número de passageiros" },
    { key: "customerOrganizationId", required: false, label: "o cliente" },
  ],
  CREATE_TOWING_REQUEST: [
    {
      key: "towTruckAssetId",
      required: true,
      label: "o guincho (veículo)",
      hint: "chame list_assets (category: vehicle, query: guincho) para encontrar opções elegíveis e pergunte ao usuário qual prefere — nunca escolha sozinho se houver mais de uma opção",
      searchTool: "list_assets",
    },
    { key: "scheduledStartsAt", required: true, label: "a data/hora do atendimento" },
    { key: "scheduledEndsAt", required: true, label: "a data/hora estimada de término" },
    { key: "origin", required: false, label: "o local de origem" },
    { key: "destination", required: false, label: "o destino" },
    { key: "customerOrganizationId", required: false, label: "o cliente" },
  ],
};

export const GOAL_MUTATION_TOOL: Record<GoalType, string> = {
  CREATE_TRANSPORT_REQUEST: "create_transport_request",
  CREATE_TOWING_REQUEST: "create_towing_request",
};

export type NextBestAction =
  | { action: "ASK_USER"; missingKey: string; label: string; hint?: string; searchTool?: string }
  | { action: "EXECUTE"; toolName: string }
  | { action: "COMPLETE" };

/** The Orchestrator's core decision (spec section 15): given the goal's
 * accumulated state (agent_goals.state) and its requirement spec, decide
 * what happens next. Only REQUIRED fields block EXECUTE — an optional
 * field missing (e.g. passengerCount) never stops the flow, matching
 * spec section 13's own "não hardcodear regras... apenas pergunta o que
 * falta" for genuinely required slots. */
export function computeNextBestAction(
  goalType: GoalType,
  state: Record<string, unknown>,
): NextBestAction {
  const requirements = GOAL_REQUIREMENTS[goalType];
  for (const req of requirements) {
    if (!req.required) continue;
    const value = state[req.key];
    if (value === undefined || value === null || value === "") {
      return {
        action: "ASK_USER",
        missingKey: req.key,
        label: req.label,
        hint: req.hint,
        searchTool: req.searchTool,
      };
    }
  }
  return { action: "EXECUTE", toolName: GOAL_MUTATION_TOOL[goalType] };
}
