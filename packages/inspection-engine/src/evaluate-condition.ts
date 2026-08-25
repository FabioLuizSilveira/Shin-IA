import type { FieldCondition } from "./types.js";

// Duplicated from packages/tenant-contract-engine/src/clause-conditions.ts
// rather than imported — same call made there for hash.ts: different
// domains, but the function is small and utility-shaped enough that a
// cross-package dependency would be artificial. Keep both in sync by hand
// if the condition grammar ever grows.
export function evaluateCondition(
  condition: FieldCondition,
  context: Record<string, unknown>,
): boolean {
  const actual = context[condition.field];
  switch (condition.op) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "gt":
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual > condition.value
      );
    case "gte":
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual >= condition.value
      );
    case "lt":
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual < condition.value
      );
    case "lte":
      return (
        typeof actual === "number" &&
        typeof condition.value === "number" &&
        actual <= condition.value
      );
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(actual);
    default:
      return false;
  }
}
