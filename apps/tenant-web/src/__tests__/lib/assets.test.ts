import { describe, it, expect } from "vitest";
import {
  computeFleetHealthScore,
  categorizeByStatus,
  averageUtilization,
  filterByCategory,
} from "../../lib/assets.js";
import type { Asset } from "../../lib/types.js";

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "a1",
    name: "Truck 01",
    category: "vehicle",
    status: "available",
    utilizationPercent: 75,
    ...overrides,
  };
}

describe("computeFleetHealthScore", () => {
  it("returns 0 for empty", () => {
    expect(computeFleetHealthScore([])).toBe(0);
  });

  it("returns 100 when all available", () => {
    const assets = [makeAsset(), makeAsset({ id: "a2" })];
    expect(computeFleetHealthScore(assets)).toBe(100);
  });

  it("counts rented as active", () => {
    const assets = [makeAsset({ status: "rented" }), makeAsset({ id: "a2" })];
    expect(computeFleetHealthScore(assets)).toBe(100);
  });

  it("excludes maintenance from active", () => {
    const assets = [
      makeAsset({ status: "available" }),
      makeAsset({ id: "a2", status: "maintenance" }),
    ];
    expect(computeFleetHealthScore(assets)).toBe(50);
  });

  it("excludes retired from active", () => {
    const assets = [makeAsset({ status: "retired" })];
    expect(computeFleetHealthScore(assets)).toBe(0);
  });
});

describe("categorizeByStatus", () => {
  it("groups by all statuses", () => {
    const assets = [
      makeAsset({ status: "available" }),
      makeAsset({ id: "a2", status: "rented" }),
      makeAsset({ id: "a3", status: "maintenance" }),
      makeAsset({ id: "a4", status: "retired" }),
    ];
    const cats = categorizeByStatus(assets);
    expect(cats.available).toHaveLength(1);
    expect(cats.rented).toHaveLength(1);
    expect(cats.maintenance).toHaveLength(1);
    expect(cats.retired).toHaveLength(1);
  });

  it("returns empty arrays for missing statuses", () => {
    const cats = categorizeByStatus([]);
    expect(cats.available).toHaveLength(0);
  });
});

describe("averageUtilization", () => {
  it("returns 0 for empty", () => {
    expect(averageUtilization([])).toBe(0);
  });

  it("computes average correctly", () => {
    const assets = [
      makeAsset({ utilizationPercent: 50 }),
      makeAsset({ id: "a2", utilizationPercent: 100 }),
    ];
    expect(averageUtilization(assets)).toBe(75);
  });
});

describe("filterByCategory", () => {
  it("filters by category", () => {
    const assets = [
      makeAsset({ category: "vehicle" }),
      makeAsset({ id: "a2", category: "equipment" }),
    ];
    expect(filterByCategory(assets, "vehicle")).toHaveLength(1);
  });

  it("returns empty when no match", () => {
    expect(filterByCategory([makeAsset({ category: "vehicle" })], "crane")).toHaveLength(0);
  });
});
