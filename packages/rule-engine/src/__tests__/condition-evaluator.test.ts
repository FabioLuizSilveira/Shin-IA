import { describe, it, expect } from "vitest";
import { ConditionEvaluator } from "../condition-evaluator.js";
import type { Condition } from "../types.js";

describe("ConditionEvaluator", () => {
  const evaluator = new ConditionEvaluator();

  const data = {
    status: "active",
    count: 10,
    name: "Vehicle Alpha",
    role: "manager",
    tags: ["premium", "fleet"],
    location: null as unknown,
    nested: { type: "forklift", level: 3 },
  };

  describe("simple conditions", () => {
    it("eq — equals", () => {
      expect(
        evaluator.evaluate(
          { type: "simple", field: "status", operator: "eq", value: "active" },
          data,
        ),
      ).toBe(true);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "status", operator: "eq", value: "inactive" },
          data,
        ),
      ).toBe(false);
    });

    it("ne — not equals", () => {
      expect(
        evaluator.evaluate(
          { type: "simple", field: "status", operator: "ne", value: "inactive" },
          data,
        ),
      ).toBe(true);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "status", operator: "ne", value: "active" },
          data,
        ),
      ).toBe(false);
    });

    it("gt — greater than", () => {
      expect(
        evaluator.evaluate({ type: "simple", field: "count", operator: "gt", value: 5 }, data),
      ).toBe(true);
      expect(
        evaluator.evaluate({ type: "simple", field: "count", operator: "gt", value: 10 }, data),
      ).toBe(false);
      expect(
        evaluator.evaluate({ type: "simple", field: "status", operator: "gt", value: 5 }, data),
      ).toBe(false); // not number
    });

    it("gte — greater than or equal", () => {
      expect(
        evaluator.evaluate({ type: "simple", field: "count", operator: "gte", value: 10 }, data),
      ).toBe(true);
      expect(
        evaluator.evaluate({ type: "simple", field: "count", operator: "gte", value: 11 }, data),
      ).toBe(false);
    });

    it("lt — less than", () => {
      expect(
        evaluator.evaluate({ type: "simple", field: "count", operator: "lt", value: 20 }, data),
      ).toBe(true);
      expect(
        evaluator.evaluate({ type: "simple", field: "count", operator: "lt", value: 10 }, data),
      ).toBe(false);
    });

    it("lte — less than or equal", () => {
      expect(
        evaluator.evaluate({ type: "simple", field: "count", operator: "lte", value: 10 }, data),
      ).toBe(true);
      expect(
        evaluator.evaluate({ type: "simple", field: "count", operator: "lte", value: 9 }, data),
      ).toBe(false);
    });

    it("in — value in array", () => {
      expect(
        evaluator.evaluate(
          { type: "simple", field: "role", operator: "in", value: ["admin", "manager"] },
          data,
        ),
      ).toBe(true);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "role", operator: "in", value: ["viewer"] },
          data,
        ),
      ).toBe(false);
    });

    it("nin — value not in array", () => {
      expect(
        evaluator.evaluate(
          { type: "simple", field: "role", operator: "nin", value: ["viewer", "guest"] },
          data,
        ),
      ).toBe(true);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "role", operator: "nin", value: ["manager"] },
          data,
        ),
      ).toBe(false);
    });

    it("contains — string contains", () => {
      expect(
        evaluator.evaluate(
          { type: "simple", field: "name", operator: "contains", value: "Alpha" },
          data,
        ),
      ).toBe(true);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "name", operator: "contains", value: "Beta" },
          data,
        ),
      ).toBe(false);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "count", operator: "contains", value: "x" },
          data,
        ),
      ).toBe(false); // not string
    });

    it("startsWith", () => {
      expect(
        evaluator.evaluate(
          { type: "simple", field: "name", operator: "startsWith", value: "Vehicle" },
          data,
        ),
      ).toBe(true);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "name", operator: "startsWith", value: "Alpha" },
          data,
        ),
      ).toBe(false);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "count", operator: "startsWith", value: "x" },
          data,
        ),
      ).toBe(false);
    });

    it("endsWith", () => {
      expect(
        evaluator.evaluate(
          { type: "simple", field: "name", operator: "endsWith", value: "Alpha" },
          data,
        ),
      ).toBe(true);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "name", operator: "endsWith", value: "Vehicle" },
          data,
        ),
      ).toBe(false);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "count", operator: "endsWith", value: "x" },
          data,
        ),
      ).toBe(false);
    });

    it("exists — field exists and non-null", () => {
      expect(
        evaluator.evaluate({ type: "simple", field: "status", operator: "exists" }, data),
      ).toBe(true);
      expect(
        evaluator.evaluate({ type: "simple", field: "location", operator: "exists" }, data),
      ).toBe(false);
      expect(
        evaluator.evaluate({ type: "simple", field: "missing", operator: "exists" }, data),
      ).toBe(false);
    });

    it("notExists — field missing or null", () => {
      expect(
        evaluator.evaluate({ type: "simple", field: "location", operator: "notExists" }, data),
      ).toBe(true);
      expect(
        evaluator.evaluate({ type: "simple", field: "missing", operator: "notExists" }, data),
      ).toBe(true);
      expect(
        evaluator.evaluate({ type: "simple", field: "status", operator: "notExists" }, data),
      ).toBe(false);
    });

    it("nested field access via dot notation", () => {
      expect(
        evaluator.evaluate(
          { type: "simple", field: "nested.type", operator: "eq", value: "forklift" },
          data,
        ),
      ).toBe(true);
      expect(
        evaluator.evaluate(
          { type: "simple", field: "nested.level", operator: "gt", value: 2 },
          data,
        ),
      ).toBe(true);
    });

    it("unknown operator returns false", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cond = {
        type: "simple",
        field: "status",
        operator: "unknownOp" as any,
        value: "active",
      };
      expect(evaluator.evaluate(cond as Condition, data)).toBe(false);
    });
  });

  describe("composite conditions", () => {
    it("and — all must be true", () => {
      const cond: Condition = {
        type: "and",
        conditions: [
          { type: "simple", field: "status", operator: "eq", value: "active" },
          { type: "simple", field: "count", operator: "gt", value: 5 },
        ],
      };
      expect(evaluator.evaluate(cond, data)).toBe(true);

      const failing: Condition = {
        type: "and",
        conditions: [
          { type: "simple", field: "status", operator: "eq", value: "active" },
          { type: "simple", field: "count", operator: "gt", value: 100 },
        ],
      };
      expect(evaluator.evaluate(failing, data)).toBe(false);
    });

    it("or — at least one must be true", () => {
      const cond: Condition = {
        type: "or",
        conditions: [
          { type: "simple", field: "status", operator: "eq", value: "inactive" },
          { type: "simple", field: "count", operator: "gt", value: 5 },
        ],
      };
      expect(evaluator.evaluate(cond, data)).toBe(true);

      const allFailing: Condition = {
        type: "or",
        conditions: [
          { type: "simple", field: "status", operator: "eq", value: "inactive" },
          { type: "simple", field: "count", operator: "gt", value: 100 },
        ],
      };
      expect(evaluator.evaluate(allFailing, data)).toBe(false);
    });
  });

  describe("not condition", () => {
    it("negates a condition", () => {
      const cond: Condition = {
        type: "not",
        condition: { type: "simple", field: "status", operator: "eq", value: "inactive" },
      };
      expect(evaluator.evaluate(cond, data)).toBe(true);

      const inverted: Condition = {
        type: "not",
        condition: { type: "simple", field: "status", operator: "eq", value: "active" },
      };
      expect(evaluator.evaluate(inverted, data)).toBe(false);
    });
  });

  describe("nested composite conditions", () => {
    it("handles deeply nested conditions", () => {
      const cond: Condition = {
        type: "and",
        conditions: [
          { type: "simple", field: "status", operator: "eq", value: "active" },
          {
            type: "or",
            conditions: [
              { type: "simple", field: "role", operator: "eq", value: "admin" },
              { type: "simple", field: "role", operator: "eq", value: "manager" },
            ],
          },
          {
            type: "not",
            condition: { type: "simple", field: "count", operator: "gt", value: 100 },
          },
        ],
      };
      expect(evaluator.evaluate(cond, data)).toBe(true);
    });
  });
});
