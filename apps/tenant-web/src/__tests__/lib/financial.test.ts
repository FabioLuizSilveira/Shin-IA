import { describe, it, expect } from "vitest";
import {
  computeGrossProfit,
  computeGrowthRate,
  summarizeRevenue,
  findBestPeriod,
} from "../../lib/financial.js";
import type { RevenueEntry } from "../../lib/types.js";

function makeEntry(overrides: Partial<RevenueEntry> = {}): RevenueEntry {
  return {
    period: "2024-01",
    gross: 10000,
    costs: 4000,
    commissions: 1000,
    ...overrides,
  };
}

describe("computeGrossProfit", () => {
  it("subtracts costs and commissions from gross", () => {
    expect(computeGrossProfit(makeEntry())).toBe(5000);
  });

  it("returns negative when costs exceed gross", () => {
    expect(computeGrossProfit(makeEntry({ gross: 100, costs: 200, commissions: 0 }))).toBe(-100);
  });

  it("returns 0 when all equal", () => {
    expect(computeGrossProfit(makeEntry({ gross: 100, costs: 50, commissions: 50 }))).toBe(0);
  });
});

describe("computeGrowthRate", () => {
  it("computes positive growth rate", () => {
    expect(computeGrowthRate(120, 100)).toBeCloseTo(20);
  });

  it("computes negative growth rate", () => {
    expect(computeGrowthRate(80, 100)).toBeCloseTo(-20);
  });

  it("returns 0 when previous is 0", () => {
    expect(computeGrowthRate(100, 0)).toBe(0);
  });

  it("returns 0 when no change", () => {
    expect(computeGrowthRate(100, 100)).toBe(0);
  });
});

describe("summarizeRevenue", () => {
  it("returns zeros for empty", () => {
    const result = summarizeRevenue([]);
    expect(result.totalGross).toBe(0);
    expect(result.totalProfit).toBe(0);
  });

  it("sums all entries", () => {
    const entries = [
      makeEntry(),
      makeEntry({ period: "2024-02", gross: 20000, costs: 8000, commissions: 2000 }),
    ];
    const result = summarizeRevenue(entries);
    expect(result.totalGross).toBe(30000);
    expect(result.totalCosts).toBe(12000);
    expect(result.totalCommissions).toBe(3000);
    expect(result.totalProfit).toBe(15000);
  });
});

describe("findBestPeriod", () => {
  it("returns null for empty", () => {
    expect(findBestPeriod([])).toBeNull();
  });

  it("returns entry with highest profit", () => {
    const entries = [
      makeEntry({ period: "2024-01", gross: 5000, costs: 4000, commissions: 0 }),
      makeEntry({ period: "2024-02", gross: 20000, costs: 4000, commissions: 0 }),
    ];
    expect(findBestPeriod(entries)?.period).toBe("2024-02");
  });

  it("returns the single entry if only one", () => {
    expect(findBestPeriod([makeEntry()])?.period).toBe("2024-01");
  });
});
