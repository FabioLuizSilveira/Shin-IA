import { describe, expect, it } from "vitest";
import { evaluateCondition } from "./clause-conditions.js";

describe("evaluateCondition", () => {
  it("eq — matches the 5 spec examples directly", () => {
    expect(
      evaluateCondition(
        { field: "operatorIncluded", op: "eq", value: true },
        { operatorIncluded: true },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "operatorIncluded", op: "eq", value: true },
        { operatorIncluded: false },
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { field: "trackingEnabled", op: "eq", value: true },
        { trackingEnabled: true },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "insuranceIncluded", op: "eq", value: true },
        { insuranceIncluded: true },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "assetCategory", op: "in", value: ["vehicle"] },
        { assetCategory: "vehicle" },
      ),
    ).toBe(true);
    expect(
      evaluateCondition({ field: "securityDeposit", op: "gt", value: 0 }, { securityDeposit: 500 }),
    ).toBe(true);
    expect(
      evaluateCondition({ field: "securityDeposit", op: "gt", value: 0 }, { securityDeposit: 0 }),
    ).toBe(false);
  });

  it("neq/gte/lte", () => {
    expect(
      evaluateCondition(
        { field: "insuranceType", op: "neq", value: "none" },
        { insuranceType: "full" },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "securityDeposit", op: "gte", value: 500 },
        { securityDeposit: 500 },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "securityDeposit", op: "lte", value: 500 },
        { securityDeposit: 500 },
      ),
    ).toBe(true);
  });

  it("in — checks membership, not equality", () => {
    expect(
      evaluateCondition(
        { field: "assetCategory", op: "in", value: ["crane", "munk"] },
        { assetCategory: "munk" },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "assetCategory", op: "in", value: ["crane", "munk"] },
        { assetCategory: "forklift" },
      ),
    ).toBe(false);
  });

  it("reads nested values from context.variables when the field isn't a top-level key", () => {
    expect(
      evaluateCondition(
        { field: "custom_flag", op: "eq", value: "yes" },
        { variables: { custom_flag: "yes" } },
      ),
    ).toBe(true);
  });

  it("numeric operators return false for non-numeric operands instead of throwing", () => {
    expect(
      evaluateCondition({ field: "insuranceType", op: "gt", value: 0 }, { insuranceType: "full" }),
    ).toBe(false);
  });
});
