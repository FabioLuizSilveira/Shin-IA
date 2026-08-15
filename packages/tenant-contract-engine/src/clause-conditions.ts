import type { ClauseCondition, RenderContext } from "./types.js";

function getField(context: RenderContext, field: string): unknown {
  if (field in context) return context[field];
  return context.variables?.[field];
}

// Pure, testable in isolation — deliberately not a bespoke DSL, just a
// field/op/value triple stored as jsonb on tenant_contract_template_clauses.
export function evaluateCondition(condition: ClauseCondition, context: RenderContext): boolean {
  const actual = getField(context, condition.field);
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
