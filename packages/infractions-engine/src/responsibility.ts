import type { ResponsibilityInput, ResponsibilitySuggestion } from "./types.js";

function within(occurredAt: string, startsAt: string, endsAt: string): boolean {
  const t = new Date(occurredAt).getTime();
  return t >= new Date(startsAt).getTime() && t <= new Date(endsAt).getTime();
}

// Responsibility resolution (item 11/12 of the spec). Pure — the caller
// resolves the real rows (contract/operation/allocation/operator
// assignment/tracking confirmation) via the temporal matching queries;
// this function only combines already-resolved facts into a suggestion.
// It NEVER writes a decision — item 12 (human-in-the-loop) is enforced by
// callers never treating this as final: a suggestion always needs a
// human confirm/reject before infraction_cases.responsibility_confirmed_at
// is set.
export function suggestResponsibility(input: ResponsibilityInput): ResponsibilitySuggestion {
  const reasons: string[] = [];

  // Strongest signal: an operator was assigned to the operation/allocation
  // that covers this exact instant, and that assignment is confirmed.
  if (input.operatorAssignment && input.operatorAssignment.status !== "declined") {
    const coveredByOperation =
      input.operation && within(input.occurredAt, input.operation.startsAt, input.operation.endsAt);
    const coveredByAllocation =
      input.allocation &&
      within(input.occurredAt, input.allocation.startsAt, input.allocation.endsAt);

    if (coveredByOperation || coveredByAllocation) {
      reasons.push(
        coveredByOperation
          ? "operator assigned to an operation covering the infraction timestamp"
          : "operator assigned to an allocation covering the infraction timestamp",
      );
      if (input.operatorAssignment.status === "confirmed") {
        reasons.push("operator assignment confirmed by the operator");
      }
      if (input.trackingConfirmed) {
        reasons.push("tracking confirms the asset was in operation at that time");
      }
      const confidence = Math.min(
        0.6 +
          (input.operatorAssignment.status === "confirmed" ? 0.2 : 0) +
          (input.trackingConfirmed ? 0.14 : 0),
        0.94,
      );
      return {
        responsibleType: "operator",
        responsibleId: input.operatorAssignment.operatorId,
        confidence,
        reasons,
      };
    }
  }

  // No operator assignment covers the moment — fall back to the customer
  // on the active contract, when one covers the timestamp.
  if (
    input.contract &&
    within(input.occurredAt, input.contract.periodStartsAt, input.contract.periodEndsAt)
  ) {
    reasons.push("active contract covers the infraction timestamp");
    if (input.customerId) {
      if (input.trackingConfirmed)
        reasons.push("tracking confirms the asset was in use at that time");
      return {
        responsibleType: "customer",
        responsibleId: input.customerId,
        confidence: input.trackingConfirmed ? 0.75 : 0.6,
        reasons,
      };
    }
    reasons.push("contract found but no customer resolved from its organization");
  }

  // Nothing covers the timestamp — no automated guess. A human decides
  // from scratch (tenant staff, or the asset was under direct tenant use).
  return {
    responsibleType: "unknown",
    responsibleId: null,
    confidence: 0,
    reasons: ["no coverage found for the infraction timestamp"],
  };
}
