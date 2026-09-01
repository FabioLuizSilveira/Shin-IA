import { describe, it, expect } from "vitest";
import { sumCostsCents, costPerUnit, downtimeHours } from "../cost.js";

describe("sumCostsCents", () => {
  it("sums labor + parts + other", () => {
    expect(sumCostsCents(10000, 5000, 250)).toBe(15250);
  });
  it("handles all-zero costs", () => {
    expect(sumCostsCents(0, 0, 0)).toBe(0);
  });
});

describe("costPerUnit", () => {
  it("divides cost by a positive unit", () => {
    expect(costPerUnit(10000, 100)).toBe(100);
  });
  it("returns null when unit is null (no odometer for this asset category)", () => {
    expect(costPerUnit(10000, null)).toBeNull();
  });
  it("returns null when unit is zero (never divides by zero)", () => {
    expect(costPerUnit(10000, 0)).toBeNull();
  });
  it("returns null when unit is negative", () => {
    expect(costPerUnit(10000, -5)).toBeNull();
  });
});

describe("downtimeHours", () => {
  it("computes hours between start and end", () => {
    expect(downtimeHours("2026-01-01T00:00:00Z", "2026-01-01T12:00:00Z")).toBe(12);
  });
  it("returns null when either bound is missing", () => {
    expect(downtimeHours(null, "2026-01-01T12:00:00Z")).toBeNull();
    expect(downtimeHours("2026-01-01T00:00:00Z", null)).toBeNull();
  });
  it("returns null for an inverted range instead of a negative number", () => {
    expect(downtimeHours("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBeNull();
  });
});
