import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../evaluate-condition.js";

describe("evaluateCondition", () => {
  it("eq", () => {
    expect(evaluateCondition({ field: "fuel", op: "eq", value: true }, { fuel: true })).toBe(true);
    expect(evaluateCondition({ field: "fuel", op: "eq", value: true }, { fuel: false })).toBe(
      false,
    );
  });

  it("neq", () => {
    expect(evaluateCondition({ field: "x", op: "neq", value: 1 }, { x: 2 })).toBe(true);
    expect(evaluateCondition({ field: "x", op: "neq", value: 1 }, { x: 1 })).toBe(false);
  });

  it("gt/gte/lt/lte", () => {
    expect(evaluateCondition({ field: "n", op: "gt", value: 5 }, { n: 6 })).toBe(true);
    expect(evaluateCondition({ field: "n", op: "gt", value: 5 }, { n: 5 })).toBe(false);
    expect(evaluateCondition({ field: "n", op: "gte", value: 5 }, { n: 5 })).toBe(true);
    expect(evaluateCondition({ field: "n", op: "lt", value: 5 }, { n: 4 })).toBe(true);
    expect(evaluateCondition({ field: "n", op: "lte", value: 5 }, { n: 5 })).toBe(true);
  });

  it("gt/gte/lt/lte return false for non-numeric operands instead of throwing", () => {
    expect(evaluateCondition({ field: "n", op: "gt", value: 5 }, { n: "not a number" })).toBe(
      false,
    );
    expect(evaluateCondition({ field: "n", op: "gt", value: "5" }, { n: 6 })).toBe(false);
  });

  it("in", () => {
    expect(evaluateCondition({ field: "cat", op: "in", value: ["a", "b"] }, { cat: "b" })).toBe(
      true,
    );
    expect(evaluateCondition({ field: "cat", op: "in", value: ["a", "b"] }, { cat: "c" })).toBe(
      false,
    );
  });

  it("missing field in context resolves to undefined, not a throw", () => {
    expect(evaluateCondition({ field: "missing", op: "eq", value: undefined }, {})).toBe(true);
    expect(evaluateCondition({ field: "missing", op: "eq", value: "x" }, {})).toBe(false);
  });
});
