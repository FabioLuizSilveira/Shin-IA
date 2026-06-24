import type { Condition, SimpleCondition, CompositeCondition, NotCondition } from "./types.js";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function evaluateSimple(condition: SimpleCondition, data: Record<string, unknown>): boolean {
  const value = getNestedValue(data, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "eq":
      return value === expected;
    case "ne":
      return value !== expected;
    case "gt":
      return typeof value === "number" && typeof expected === "number" && value > expected;
    case "gte":
      return typeof value === "number" && typeof expected === "number" && value >= expected;
    case "lt":
      return typeof value === "number" && typeof expected === "number" && value < expected;
    case "lte":
      return typeof value === "number" && typeof expected === "number" && value <= expected;
    case "in":
      return Array.isArray(expected) && expected.includes(value);
    case "nin":
      return Array.isArray(expected) && !expected.includes(value);
    case "contains":
      return typeof value === "string" && typeof expected === "string" && value.includes(expected);
    case "startsWith":
      return (
        typeof value === "string" && typeof expected === "string" && value.startsWith(expected)
      );
    case "endsWith":
      return typeof value === "string" && typeof expected === "string" && value.endsWith(expected);
    case "exists":
      return value !== undefined && value !== null;
    case "notExists":
      return value === undefined || value === null;
    default:
      return false;
  }
}

function evaluateComposite(condition: CompositeCondition, data: Record<string, unknown>): boolean {
  if (condition.type === "and") {
    return condition.conditions.every((c) => evaluate(c, data));
  }
  return condition.conditions.some((c) => evaluate(c, data));
}

function evaluateNot(condition: NotCondition, data: Record<string, unknown>): boolean {
  return !evaluate(condition.condition, data);
}

export function evaluate(condition: Condition, data: Record<string, unknown>): boolean {
  switch (condition.type) {
    case "simple":
      return evaluateSimple(condition, data);
    case "and":
    case "or":
      return evaluateComposite(condition, data);
    case "not":
      return evaluateNot(condition, data);
  }
}

export class ConditionEvaluator {
  evaluate(condition: Condition, data: Record<string, unknown>): boolean {
    return evaluate(condition, data);
  }
}
