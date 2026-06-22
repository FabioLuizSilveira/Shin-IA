import { describe, it, expect } from "vitest";
import {
  aggregateMetrics,
  detectAnomalies,
  formatUptime,
  groupByLabel,
} from "../../lib/observability.js";
import type { MetricPoint } from "../../lib/types.js";

function makePoint(value: number, labels?: Record<string, string>): MetricPoint {
  return { value, timestamp: "2024-01-01T00:00:00Z", labels };
}

describe("aggregateMetrics", () => {
  it("returns zeros for empty", () => {
    const result = aggregateMetrics([]);
    expect(result.min).toBe(0);
    expect(result.max).toBe(0);
    expect(result.avg).toBe(0);
    expect(result.sum).toBe(0);
    expect(result.count).toBe(0);
  });

  it("computes correct aggregates", () => {
    const result = aggregateMetrics([makePoint(10), makePoint(20), makePoint(30)]);
    expect(result.min).toBe(10);
    expect(result.max).toBe(30);
    expect(result.avg).toBe(20);
    expect(result.sum).toBe(60);
    expect(result.count).toBe(3);
  });

  it("handles single point", () => {
    const result = aggregateMetrics([makePoint(42)]);
    expect(result.min).toBe(42);
    expect(result.max).toBe(42);
    expect(result.avg).toBe(42);
  });
});

describe("detectAnomalies", () => {
  it("returns empty for empty input", () => {
    expect(detectAnomalies([], 10)).toHaveLength(0);
  });

  it("detects points far from average", () => {
    const points = [makePoint(10), makePoint(12), makePoint(11), makePoint(100)];
    const anomalies = detectAnomalies(points, 30);
    expect(anomalies.some((p) => p.value === 100)).toBe(true);
  });

  it("returns empty when all within threshold", () => {
    const points = [makePoint(10), makePoint(11), makePoint(12)];
    expect(detectAnomalies(points, 100)).toHaveLength(0);
  });
});

describe("formatUptime", () => {
  it("formats seconds", () => {
    expect(formatUptime(45)).toBe("45s");
  });

  it("formats minutes", () => {
    expect(formatUptime(150)).toBe("2m");
  });

  it("formats hours", () => {
    expect(formatUptime(7200)).toBe("2h");
  });

  it("formats days", () => {
    expect(formatUptime(86400 * 3)).toBe("3d");
  });

  it("formats exactly 59 seconds as seconds", () => {
    expect(formatUptime(59)).toBe("59s");
  });
});

describe("groupByLabel", () => {
  it("groups by label key", () => {
    const points = [
      makePoint(1, { env: "prod" }),
      makePoint(2, { env: "staging" }),
      makePoint(3, { env: "prod" }),
    ];
    const groups = groupByLabel(points, "env");
    expect(groups["prod"]).toHaveLength(2);
    expect(groups["staging"]).toHaveLength(1);
  });

  it("uses 'unknown' for missing label", () => {
    const points = [makePoint(1), makePoint(2)];
    const groups = groupByLabel(points, "env");
    expect(groups["unknown"]).toHaveLength(2);
  });

  it("returns empty object for empty points", () => {
    expect(Object.keys(groupByLabel([], "env"))).toHaveLength(0);
  });
});
