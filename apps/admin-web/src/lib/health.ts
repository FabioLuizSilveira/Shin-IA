import type { CheckStatus, HealthCheck } from "./types.js";

export interface HealthStatus {
  status: CheckStatus;
  score: number;
  checks: HealthCheck[];
  timestamp: string;
}

export function computeHealthScore(checks: HealthCheck[]): number {
  if (checks.length === 0) return 100;
  const healthyCount = checks.filter((c) => c.status === "healthy").length;
  const degradedCount = checks.filter((c) => c.status === "degraded").length;
  return Math.round(((healthyCount + degradedCount * 0.5) / checks.length) * 100);
}

export function computeHealthStatus(checks: HealthCheck[] = []): HealthStatus {
  const score = computeHealthScore(checks);
  const status: CheckStatus = score >= 80 ? "healthy" : score >= 50 ? "degraded" : "down";
  return { status, score, checks, timestamp: new Date().toISOString() };
}

export function categorizeChecks(checks: HealthCheck[]): Record<CheckStatus, HealthCheck[]> {
  return {
    healthy: checks.filter((c) => c.status === "healthy"),
    degraded: checks.filter((c) => c.status === "degraded"),
    down: checks.filter((c) => c.status === "down"),
  };
}

export function averageLatency(checks: HealthCheck[]): number {
  const withLatency = checks.filter((c) => c.latencyMs !== undefined);
  if (withLatency.length === 0) return 0;
  return withLatency.reduce((sum, c) => sum + (c.latencyMs ?? 0), 0) / withLatency.length;
}
