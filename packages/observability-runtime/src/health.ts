import type { HealthCheckResult, HealthStatus } from "./types.js";
import { ObservabilityError } from "./metrics.js";

export type CheckFn = () => HealthCheckResult | Promise<HealthCheckResult>;

export class HealthAggregator {
  private readonly checks = new Map<string, CheckFn>();

  register(name: string, fn: CheckFn): void {
    this.checks.set(name, fn);
  }

  unregister(name: string): void {
    if (!this.checks.has(name)) {
      throw new ObservabilityError(`Health check not found: ${name}`, "CHECK_NOT_FOUND");
    }
    this.checks.delete(name);
  }

  async runCheck(name: string): Promise<HealthCheckResult> {
    const fn = this.checks.get(name);
    if (!fn) throw new ObservabilityError(`Health check not found: ${name}`, "CHECK_NOT_FOUND");
    return fn();
  }

  async runAll(): Promise<HealthCheckResult[]> {
    const results = await Promise.all([...this.checks.values()].map((fn) => fn()));
    return results;
  }

  computeOverallHealth(results: HealthCheckResult[]): HealthStatus {
    if (results.length === 0) return "healthy";
    if (results.every((r) => r.status === "healthy")) return "healthy";
    if (results.some((r) => r.status === "down")) return "down";
    return "degraded";
  }

  async getReport(): Promise<{ status: HealthStatus; checks: HealthCheckResult[] }> {
    const checks = await this.runAll();
    return { status: this.computeOverallHealth(checks), checks };
  }
}
