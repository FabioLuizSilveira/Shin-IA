import type { AlertRule, AlertSeverity } from "./types.js";
import { ObservabilityError } from "./metrics.js";

export class AlertEngine {
  private readonly rules = new Map<string, AlertRule>();

  addRule(rule: AlertRule): void {
    if (this.rules.has(rule.id)) {
      throw new ObservabilityError(`Alert rule already exists: ${rule.id}`, "DUPLICATE_RULE");
    }
    this.rules.set(rule.id, { ...rule, state: "ok" });
  }

  removeRule(id: string): void {
    if (!this.rules.has(id)) {
      throw new ObservabilityError(`Alert rule not found: ${id}`, "RULE_NOT_FOUND");
    }
    this.rules.delete(id);
  }

  evaluate(metricName: string, value: number): AlertRule[] {
    const fired: AlertRule[] = [];
    for (const [id, rule] of this.rules) {
      if (rule.metricName !== metricName) continue;
      if (value > rule.threshold && rule.state !== "acknowledged") {
        const updated = { ...rule, state: "firing" as const };
        this.rules.set(id, updated);
        fired.push(updated);
      } else if (value <= rule.threshold && rule.state === "firing") {
        this.rules.set(id, { ...rule, state: "ok" });
      }
    }
    return fired;
  }

  acknowledge(id: string): void {
    const rule = this.rules.get(id);
    if (!rule) throw new ObservabilityError(`Alert rule not found: ${id}`, "RULE_NOT_FOUND");
    if (rule.state !== "firing")
      throw new ObservabilityError(`Rule is not firing: ${id}`, "NOT_FIRING");
    this.rules.set(id, { ...rule, state: "acknowledged" });
  }

  listFiring(): AlertRule[] {
    return [...this.rules.values()].filter((r) => r.state === "firing");
  }

  listBySeverity(severity: AlertSeverity): AlertRule[] {
    return [...this.rules.values()].filter((r) => r.severity === severity);
  }

  clearAll(): void {
    for (const [id, rule] of this.rules) {
      this.rules.set(id, { ...rule, state: "ok" });
    }
  }

  count(): number {
    return this.rules.size;
  }
}
