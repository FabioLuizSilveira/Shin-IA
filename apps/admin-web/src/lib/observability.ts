import type { MetricPoint } from "./types.js";

export interface AggregatedMetric {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
}

export function aggregateMetrics(points: MetricPoint[]): AggregatedMetric {
  if (points.length === 0) {
    return { min: 0, max: 0, avg: 0, sum: 0, count: 0 };
  }
  const values = points.map((p) => p.value);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: sum / values.length,
    sum,
    count: points.length,
  };
}

export function detectAnomalies(points: MetricPoint[], threshold: number): MetricPoint[] {
  if (points.length === 0) return [];
  const { avg } = aggregateMetrics(points);
  return points.filter((p) => Math.abs(p.value - avg) > threshold);
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function groupByLabel(
  points: MetricPoint[],
  labelKey: string,
): Record<string, MetricPoint[]> {
  const result: Record<string, MetricPoint[]> = {};
  for (const point of points) {
    const label = point.labels?.[labelKey] ?? "unknown";
    const existing = result[label];
    if (existing) {
      existing.push(point);
    } else {
      result[label] = [point];
    }
  }
  return result;
}
