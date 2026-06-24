import { describe, it, expect } from "vitest";
import {
  computeHealthScore,
  computeHealthStatus,
  categorizeChecks,
  averageLatency,
} from "../../lib/health.js";
import type { HealthCheck } from "../../lib/types.js";

function makeCheck(overrides: Partial<HealthCheck> = {}): HealthCheck {
  return { name: "Service", status: "healthy", ...overrides };
}

describe("computeHealthScore", () => {
  it("returns 100 for empty (no checks = fully healthy)", () => {
    expect(computeHealthScore([])).toBe(100);
  });

  it("returns 100 for all healthy", () => {
    const checks = [makeCheck(), makeCheck({ name: "DB" })];
    expect(computeHealthScore(checks)).toBe(100);
  });

  it("scores degraded as 0.5", () => {
    const checks = [
      makeCheck({ status: "healthy" }),
      makeCheck({ name: "DB", status: "degraded" }),
    ];
    const score = computeHealthScore(checks);
    expect(score).toBe(75);
  });

  it("returns 0 for all down", () => {
    const checks = [makeCheck({ status: "down" }), makeCheck({ name: "DB", status: "down" })];
    expect(computeHealthScore(checks)).toBe(0);
  });

  it("handles mix of healthy/degraded/down", () => {
    const checks = [
      makeCheck({ status: "healthy" }),
      makeCheck({ name: "DB", status: "degraded" }),
      makeCheck({ name: "Cache", status: "down" }),
    ];
    const score = computeHealthScore(checks);
    expect(score).toBeCloseTo(50, 0);
  });
});

describe("computeHealthStatus", () => {
  it("returns healthy when score >= 80", () => {
    const checks = [makeCheck(), makeCheck({ name: "DB" })];
    expect(computeHealthStatus(checks).status).toBe("healthy");
  });

  it("returns degraded when score >= 50 and < 80", () => {
    const checks = [
      makeCheck({ status: "healthy" }),
      makeCheck({ name: "DB", status: "degraded" }),
      makeCheck({ name: "Cache", status: "down" }),
    ];
    expect(computeHealthStatus(checks).status).toBe("degraded");
  });

  it("returns down when score < 50", () => {
    const checks = [makeCheck({ status: "down" }), makeCheck({ name: "DB", status: "down" })];
    expect(computeHealthStatus(checks).status).toBe("down");
  });

  it("returns healthy for empty (score=100)", () => {
    expect(computeHealthStatus([]).status).toBe("healthy");
  });

  it("includes score in result", () => {
    const result = computeHealthStatus([makeCheck()]);
    expect(result.score).toBe(100);
  });
});

describe("categorizeChecks", () => {
  it("groups checks by status", () => {
    const checks = [
      makeCheck({ status: "healthy" }),
      makeCheck({ name: "DB", status: "degraded" }),
      makeCheck({ name: "Cache", status: "down" }),
    ];
    const result = categorizeChecks(checks);
    expect(result.healthy).toHaveLength(1);
    expect(result.degraded).toHaveLength(1);
    expect(result.down).toHaveLength(1);
  });

  it("returns empty groups for no checks", () => {
    const result = categorizeChecks([]);
    expect(result.healthy).toHaveLength(0);
    expect(result.degraded).toHaveLength(0);
    expect(result.down).toHaveLength(0);
  });
});

describe("averageLatency", () => {
  it("returns 0 for empty", () => {
    expect(averageLatency([])).toBe(0);
  });

  it("returns 0 if no checks have latencyMs", () => {
    const checks = [makeCheck()];
    expect(averageLatency(checks)).toBe(0);
  });

  it("averages latencyMs values", () => {
    const checks = [makeCheck({ latencyMs: 100 }), makeCheck({ name: "DB", latencyMs: 200 })];
    expect(averageLatency(checks)).toBe(150);
  });

  it("ignores checks without latencyMs", () => {
    const checks = [makeCheck({ latencyMs: 100 }), makeCheck({ name: "DB" })];
    expect(averageLatency(checks)).toBe(100);
  });
});
