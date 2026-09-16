import type { ToolDomain, ToolIntent } from "./tool-taxonomy";
import type { IntentClassification } from "./intent-router";

// Agent Runtime Architecture v2, Wave 2 (spec sections 10-11) — narrows an
// ALREADY IAM-filtered tool list (permission + feature flag, unchanged —
// see spec section 13: "Tool Discovery não é Security", this router never
// substitutes that check, only runs after it) down to the small set that
// actually matches the classified intent.
//
// Fallback policy (spec section 9's confidence tiers + section 52's
// progressive migration): a tool with no `domain` tag hasn't been
// migrated to Tool Registry v2 yet (Wave 1 only annotated the
// ORGANIZATION slice) — it is NOT penalized for that. It stays in the
// candidate set whenever the classifier doesn't confidently route
// somewhere else, so today's un-annotated 38 tools keep working exactly
// as before. LOW confidence, or a domain with zero annotated tools,
// degrades to that same "everything un-annotated stays visible" set —
// never to "send everything, annotated or not" (spec section 9: "LOW ≠
// send all 100 tools").

interface DomainTaggedTool {
  name: string;
  domain?: ToolDomain;
  intents?: ToolIntent[];
}

export interface ToolFilterResult<T> {
  candidates: T[];
  /** True only when the classifier was HIGH-confidence AND exactly one
   * domain-matching tool remains — the caller may then force tool_choice
   * (spec section 12) instead of leaving it to "auto". */
  forced: boolean;
  /** Set together with `forced` — the one tool name to force. */
  forcedToolName: string | null;
  candidatesBeforeFilter: number;
  candidatesAfterFilter: number;
  /** Wave 4 — true whenever this result came from the fallback() branch
   * (no domain, LOW confidence, or a domain with zero annotated tools
   * yet), false whenever a real domain match narrowed the set. NOT the
   * same thing as "candidatesAfterFilter < candidatesBeforeFilter" — a
   * fallback still excludes the OTHER domains' annotated tools (e.g. the
   * 3 ORGANIZATION tools get excluded from an ASSET-classified fallback,
   * a real live test caught this: that exclusion alone shrinks the
   * count even though nothing was actually narrowed toward ASSET).
   * Model Router (model-router.ts) uses this, not the raw counts, to
   * decide whether the model still faces a wide, ambiguous catalog. */
  isFallback: boolean;
}

function dedupe<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    out.push(item);
  }
  return out;
}

export function filterToolsByIntent<T extends DomainTaggedTool>(
  tools: T[],
  classification: IntentClassification,
  alwaysAvailableNames: ReadonlySet<string>,
): ToolFilterResult<T> {
  const candidatesBeforeFilter = tools.length;
  const always = tools.filter((t) => alwaysAvailableNames.has(t.name));
  const unannotated = tools.filter((t) => !t.domain);
  const fallback = (): ToolFilterResult<T> => {
    const candidates = dedupe([...always, ...unannotated]);
    return {
      candidates,
      forced: false,
      forcedToolName: null,
      candidatesBeforeFilter,
      candidatesAfterFilter: candidates.length,
      isFallback: true,
    };
  };

  if (!classification.domain || classification.confidence === "LOW") return fallback();

  const domainMatches = tools.filter((t) => t.domain === classification.domain);
  if (domainMatches.length === 0) return fallback(); // domain resolved but not migrated yet

  const intentMatches = classification.intent
    ? domainMatches.filter((t) => t.intents?.includes(classification.intent!))
    : domainMatches;
  const matched = intentMatches.length > 0 ? intentMatches : domainMatches;

  const candidates = dedupe([...always, ...matched]);
  const forced = classification.confidence === "HIGH" && matched.length === 1;
  return {
    candidates,
    forced,
    forcedToolName: forced ? matched[0].name : null,
    candidatesBeforeFilter,
    candidatesAfterFilter: candidates.length,
    isFallback: false,
  };
}
