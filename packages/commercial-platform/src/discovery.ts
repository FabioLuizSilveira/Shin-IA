import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 2 — the adaptive, jargon-free discovery questionnaire. The catalog is
// `vertical_discovery_questions`; adaptivity is DETERMINISTIC: given the set
// of answers so far, `nextDiscoveryQuestion` always returns the same next
// question. A question is skipped when `applies_to_verticals` is non-empty
// and the chosen primary vertical is not in it.

export type DiscoveryQuestionType =
  | "single_select"
  | "multi_select"
  | "number"
  | "range"
  | "boolean";

export interface DiscoveryOption {
  value: string;
  label: string;
}

export interface DiscoveryQuestion {
  key: string;
  prompt: string;
  helpText: string | null;
  questionType: DiscoveryQuestionType;
  options: DiscoveryOption[];
  appliesToVerticals: string[];
  mapsTo: string;
  required: boolean;
  sortOrder: number;
}

export interface DiscoveryAnswer {
  questionKey: string;
  value: unknown;
}

interface Row {
  key: string;
  prompt: string;
  help_text: string | null;
  question_type: DiscoveryQuestionType;
  options: DiscoveryOption[];
  applies_to_verticals: string[];
  maps_to: string;
  required: boolean;
  sort_order: number;
}

function fromRow(r: Row): DiscoveryQuestion {
  return {
    key: r.key,
    prompt: r.prompt,
    helpText: r.help_text,
    questionType: r.question_type,
    options: r.options ?? [],
    appliesToVerticals: r.applies_to_verticals ?? [],
    mapsTo: r.maps_to,
    required: r.required,
    sortOrder: r.sort_order,
  };
}

export async function listDiscoveryQuestions(db: SupabaseClient): Promise<DiscoveryQuestion[]> {
  const { data, error } = await db
    .from("vertical_discovery_questions")
    .select(
      "key, prompt, help_text, question_type, options, applies_to_verticals, maps_to, required, sort_order",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as Row[] | null)?.map(fromRow) ?? [];
}

/** True when the question is relevant given the tenant's selected vertical(s) — the primary one, or (WAVE 2 — Multi-Operation Business Architecture v2) any additional one picked in "other_activities". A tenant running rental + towing + passenger transport must see every operation's own follow-up questions, not just the primary's. */
export function questionApplies(question: DiscoveryQuestion, verticals: string[]): boolean {
  if (question.appliesToVerticals.length === 0) return true;
  if (verticals.length === 0) return false;
  return question.appliesToVerticals.some((v) => verticals.includes(v));
}

/** The full set of operation verticals selected so far: the primary_activity answer plus every value picked in other_activities (WAVE 2 — Multi-Operation Business Architecture v2). Order-independent, deduplicated. */
export function collectSelectedVerticals(answers: DiscoveryAnswer[]): string[] {
  const primary = answers.find((a) => a.questionKey === "primary_activity")?.value;
  const additional = answers.find((a) => a.questionKey === "other_activities")?.value;
  const verticals = new Set<string>();
  if (typeof primary === "string" && primary) verticals.add(primary);
  if (Array.isArray(additional)) {
    for (const v of additional) if (typeof v === "string" && v) verticals.add(v);
  }
  return [...verticals];
}

/**
 * The next unanswered, applicable question — or null when discovery is
 * complete. Deterministic: depends only on (questions, answers). Considers
 * every selected vertical (primary + additional), not just the primary one.
 */
export function nextDiscoveryQuestion(
  questions: DiscoveryQuestion[],
  answers: DiscoveryAnswer[],
): DiscoveryQuestion | null {
  const answered = new Set(answers.map((a) => a.questionKey));
  const verticals = collectSelectedVerticals(answers);

  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const q of ordered) {
    if (answered.has(q.key)) continue;
    if (!questionApplies(q, verticals)) continue;
    return q;
  }
  return null;
}

/** Every required, applicable question has an answer (optional ones may remain). */
export function isDiscoveryComplete(
  questions: DiscoveryQuestion[],
  answers: DiscoveryAnswer[],
): boolean {
  const answered = new Set(answers.map((a) => a.questionKey));
  const verticals = collectSelectedVerticals(answers);
  return questions
    .filter((q) => q.required && questionApplies(q, verticals))
    .every((q) => answered.has(q.key));
}
