import { describe, it, expect } from "vitest";
import {
  computeAvailability,
  computeErrorBudget,
  computeBurnRate,
  isBreaching,
  computeSLOStatus,
  formatSLOReport,
} from "../slo.js";
import type { SLODefinition } from "../types.js";

const SLO_99: SLODefinition = { name: "API Availability", targetPercent: 99, windowDays: 30 };

describe("computeAvailability", () => {
  it("returns 100 for zero requests", () => {
    expect(computeAvailability(0, 0)).toBe(100);
  });

  it("returns 100 for no failures", () => {
    expect(computeAvailability(1000, 0)).toBe(100);
  });

  it("computes correctly for some failures", () => {
    expect(computeAvailability(1000, 10)).toBeCloseTo(99);
  });

  it("returns 0 for all failures", () => {
    expect(computeAvailability(100, 100)).toBe(0);
  });
});

describe("computeErrorBudget", () => {
  it("returns 100 when at perfect availability", () => {
    expect(computeErrorBudget(SLO_99, 100)).toBe(100);
  });

  it("returns 0 when at target", () => {
    expect(computeErrorBudget(SLO_99, 99)).toBeCloseTo(0);
  });

  it("returns 0 when below target", () => {
    expect(computeErrorBudget(SLO_99, 95)).toBe(0);
  });

  it("returns partial budget when above target", () => {
    const budget = computeErrorBudget(SLO_99, 99.5);
    expect(budget).toBeGreaterThan(0);
    expect(budget).toBeLessThan(100);
  });
});

describe("computeBurnRate", () => {
  it("returns 0 when window fraction is 0", () => {
    expect(computeBurnRate(50, 0)).toBe(0);
  });

  it("computes burn rate", () => {
    expect(computeBurnRate(50, 0.5)).toBe(100);
  });
});

describe("isBreaching", () => {
  it("returns false when above target", () => {
    expect(isBreaching(SLO_99, 99.5)).toBe(false);
  });

  it("returns true when below target", () => {
    expect(isBreaching(SLO_99, 98)).toBe(true);
  });

  it("returns false at exactly target", () => {
    expect(isBreaching(SLO_99, 99)).toBe(false);
  });
});

describe("computeSLOStatus", () => {
  it("returns breaching status when below target", () => {
    const status = computeSLOStatus(SLO_99, 98);
    expect(status.isBreaching).toBe(true);
    expect(status.currentPercent).toBe(98);
  });

  it("returns ok status when above target", () => {
    const status = computeSLOStatus(SLO_99, 99.9);
    expect(status.isBreaching).toBe(false);
  });

  it("includes error budget remaining", () => {
    const status = computeSLOStatus(SLO_99, 99.9);
    expect(status.errorBudgetRemaining).toBeGreaterThan(0);
  });
});

describe("formatSLOReport", () => {
  it("includes BREACHING when breaching", () => {
    const status = computeSLOStatus(SLO_99, 97);
    expect(formatSLOReport(status)).toContain("BREACHING");
  });

  it("includes OK when not breaching", () => {
    const status = computeSLOStatus(SLO_99, 99.9);
    expect(formatSLOReport(status)).toContain("OK");
  });

  it("includes SLO name", () => {
    const status = computeSLOStatus(SLO_99, 99);
    expect(formatSLOReport(status)).toContain("API Availability");
  });
});
