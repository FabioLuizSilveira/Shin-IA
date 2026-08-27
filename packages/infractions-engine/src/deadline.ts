import type { DeadlineInput, ResolvedDeadline } from "./types.js";

// Deadline resolution (item 17 of the spec). Never invents a legal rule
// without a source: when the provider/document already supplies a due
// date, that wins outright (source="provider"). Only when explicitly
// asked to calculate (daysFromBase + baseDate given) does this compute
// one, and it always records ruleVersion/baseDate for audit — an
// un-sourced, un-versioned calculated deadline is exactly what item 17
// forbids.
export function resolveDeadline(input: DeadlineInput): ResolvedDeadline | null {
  if (input.dueAt) {
    return { dueAt: input.dueAt, source: "provider", ruleVersion: null, baseDate: null };
  }
  if (input.baseDate && input.daysFromBase !== undefined && input.ruleVersion) {
    const base = new Date(input.baseDate);
    base.setDate(base.getDate() + input.daysFromBase);
    return {
      dueAt: base.toISOString(),
      source: "calculated",
      ruleVersion: input.ruleVersion,
      baseDate: input.baseDate,
    };
  }
  // Not enough information to responsibly produce a deadline — the
  // caller must leave this deadline type unset rather than guess.
  return null;
}

export function deadlineStatusFor(
  dueAt: string,
  now: Date,
  dueSoonWindowDays: number,
): "open" | "due_soon" | "overdue" {
  const due = new Date(dueAt).getTime();
  const nowMs = now.getTime();
  if (due < nowMs) return "overdue";
  const dueSoonThreshold = due - dueSoonWindowDays * 24 * 60 * 60 * 1000;
  if (nowMs >= dueSoonThreshold) return "due_soon";
  return "open";
}
