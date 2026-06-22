import { describe, it, expect } from "vitest";
import {
  aggregateByPeriod,
  filterByStatus,
  computeTotalCommissions,
  groupByAgent,
} from "../../lib/commissions.js";
import type { Commission } from "../../lib/types.js";

function makeCommission(overrides: Partial<Commission> = {}): Commission {
  return {
    id: "cm1",
    agentName: "Alice",
    amount: 500,
    period: "2024-01",
    status: "pending",
    ...overrides,
  };
}

describe("aggregateByPeriod", () => {
  it("returns empty object for no commissions", () => {
    expect(aggregateByPeriod([])).toEqual({});
  });

  it("sums amounts per period", () => {
    const commissions = [
      makeCommission({ period: "2024-01", amount: 200 }),
      makeCommission({ id: "cm2", period: "2024-01", amount: 300 }),
      makeCommission({ id: "cm3", period: "2024-02", amount: 400 }),
    ];
    const result = aggregateByPeriod(commissions);
    expect(result["2024-01"]).toBe(500);
    expect(result["2024-02"]).toBe(400);
  });
});

describe("filterByStatus", () => {
  it("filters to pending only", () => {
    const commissions = [
      makeCommission({ status: "pending" }),
      makeCommission({ id: "cm2", status: "paid" }),
    ];
    expect(filterByStatus(commissions, "pending")).toHaveLength(1);
  });

  it("returns empty when no match", () => {
    expect(filterByStatus([makeCommission()], "disputed")).toHaveLength(0);
  });

  it("filters approved", () => {
    const commissions = [makeCommission({ status: "approved" })];
    expect(filterByStatus(commissions, "approved")).toHaveLength(1);
  });
});

describe("computeTotalCommissions", () => {
  it("returns 0 for empty", () => {
    expect(computeTotalCommissions([])).toBe(0);
  });

  it("sums all amounts", () => {
    const commissions = [
      makeCommission({ amount: 100 }),
      makeCommission({ id: "cm2", amount: 250 }),
    ];
    expect(computeTotalCommissions(commissions)).toBe(350);
  });
});

describe("groupByAgent", () => {
  it("returns empty object for no commissions", () => {
    expect(groupByAgent([])).toEqual({});
  });

  it("groups by agent name", () => {
    const commissions = [
      makeCommission({ agentName: "Alice" }),
      makeCommission({ id: "cm2", agentName: "Bob" }),
      makeCommission({ id: "cm3", agentName: "Alice" }),
    ];
    const groups = groupByAgent(commissions);
    expect(groups["Alice"]).toHaveLength(2);
    expect(groups["Bob"]).toHaveLength(1);
  });
});
