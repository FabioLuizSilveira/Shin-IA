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

/** True when the question is relevant given the chosen primary vertical. */
export function questionApplies(
  question: DiscoveryQuestion,
  primaryVertical: string | null,
): boolean {
  if (question.appliesToVerticals.length === 0) return true;
  if (!primaryVertical) return false;
  return question.appliesToVerticals.includes(primaryVertical);
}

/**
 * The next unanswered, applicable question — or null when discovery is
 * complete. Deterministic: depends only on (questions, answers). The primary
 * vertical is read from the `primary_activity` answer as soon as it exists.
 */
export function nextDiscoveryQuestion(
  questions: DiscoveryQuestion[],
  answers: DiscoveryAnswer[],
): DiscoveryQuestion | null {
  const answered = new Set(answers.map((a) => a.questionKey));
  const primaryAnswer = answers.find((a) => a.questionKey === "primary_activity");
  const primaryVertical =
    primaryAnswer && typeof primaryAnswer.value === "string" ? primaryAnswer.value : null;

  const ordered = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const q of ordered) {
    if (answered.has(q.key)) continue;
    if (!questionApplies(q, primaryVertical)) continue;
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
  const primaryAnswer = answers.find((a) => a.questionKey === "primary_activity");
  const primaryVertical =
    primaryAnswer && typeof primaryAnswer.value === "string" ? primaryAnswer.value : null;
  return questions
    .filter((q) => q.required && questionApplies(q, primaryVertical))
    .every((q) => answered.has(q.key));
}
