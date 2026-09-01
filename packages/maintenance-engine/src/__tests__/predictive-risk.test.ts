import { describe, it, expect } from "vitest";
import { computePredictiveRisk } from "../predictive-risk.js";
import type { AssetHealthScoreResult } from "../health-score.js";
import type { MaintenanceAnomaly } from "../anomaly-detection.js";
import type { PlanDueResult } from "../types.js";

function health(score: number, band: AssetHealthScoreResult["band"]): AssetHealthScoreResult {
  return {
    version: 1,
    score,
    band,
    deductions: { overduePreventive: 0, correctiveFrequency: 0, downtime: 0, staleOpenOrders: 0 },
  };
}

const now = new Date("2026-06-01T00:00:00Z");

describe("computePredictiveRisk", () => {
  it("is low risk for a perfectly healthy asset with no anomalies and nothing approaching due", () => {
    const result = computePredictiveRisk({
      now,
      healthScore: health(100, "healthy"),
      anomalies: [],
      plans: [],
    });
    expect(result.score).toBe(0);
    expect(result.tier).toBe("low");
    expect(result.approachingPreventiveDue).toBe(false);
    expect(result.highSeverityAnomalyCount).toBe(0);
  });

  it("always carries the same explicit non-prediction disclaimer", () => {
    const result = computePredictiveRisk({
      now,
      healthScore: health(100, "healthy"),
      anomalies: [],
      plans: [],
    });
    expect(result.disclaimer).toMatch(/não é uma previsão de falha/);
  });

  it("risk grows as health score drops -- exactly its complement when no other signal fires", () => {
    const result = computePredictiveRisk({
      now,
      healthScore: health(70, "attention"),
      anomalies: [],
      plans: [],
    });
    expect(result.score).toBe(30);
  });

  it("caps the anomaly contribution at 20 regardless of how many high-severity anomalies exist", () => {
    const manyAnomalies: MaintenanceAnomaly[] = Array.from({ length: 10 }, () => ({
      type: "cost_outlier",
      severity: "high",
      message: "x",
      orderId: null,
      relatedOrderId: null,
    }));
    const result = computePredictiveRisk({
      now,
      healthScore: health(100, "healthy"),
      anomalies: manyAnomalies,
      plans: [],
    });
    expect(result.score).toBe(20); // capped, not 100
    expect(result.highSeverityAnomalyCount).toBe(10);
  });

  it("ignores medium/low severity anomalies entirely", () => {
    const anomalies: MaintenanceAnomaly[] = [
      {
        type: "recurring_component",
        severity: "medium",
        message: "x",
        orderId: null,
        relatedOrderId: null,
      },
      {
        type: "recurring_component",
        severity: "low",
        message: "x",
        orderId: null,
        relatedOrderId: null,
      },
    ];
    const result = computePredictiveRisk({
      now,
      healthScore: health(100, "healthy"),
      anomalies,
      plans: [],
    });
    expect(result.score).toBe(0);
    expect(result.highSeverityAnomalyCount).toBe(0);
  });

  it("flags an odometer plan approaching due (within 15% of interval) but not yet due", () => {
    const plansDue: PlanDueResult = {
      isDue: false,
      estimates: [{ kind: "odometer", dueAtValue: 60000, remaining: 800 }], // 800/10000 = 8%
      nearest: null,
    };
    const result = computePredictiveRisk({
      now,
      healthScore: health(100, "healthy"),
      anomalies: [],
      plans: [
        { result: plansDue, intervalOdometer: 10000, intervalHourMeter: null, intervalDays: null },
      ],
    });
    expect(result.approachingPreventiveDue).toBe(true);
    expect(result.score).toBe(15);
  });

  it("does not flag a plan with plenty of remaining distance as approaching due", () => {
    const plansDue: PlanDueResult = {
      isDue: false,
      estimates: [{ kind: "odometer", dueAtValue: 60000, remaining: 8000 }], // 80% remaining
      nearest: null,
    };
    const result = computePredictiveRisk({
      now,
      healthScore: health(100, "healthy"),
      anomalies: [],
      plans: [
        { result: plansDue, intervalOdometer: 10000, intervalHourMeter: null, intervalDays: null },
      ],
    });
    expect(result.approachingPreventiveDue).toBe(false);
  });

  it("flags a date-based plan approaching due, scoped to its own intervalDays", () => {
    const dueSoon = new Date(now.getTime() + 10 * 86_400_000).toISOString(); // 10 days out
    const plansDue: PlanDueResult = {
      isDue: false,
      estimates: [{ kind: "date", dueAt: dueSoon }],
      nearest: null,
    };
    const result = computePredictiveRisk({
      now,
      healthScore: health(100, "healthy"),
      anomalies: [],
      plans: [
        { result: plansDue, intervalOdometer: null, intervalHourMeter: null, intervalDays: 180 },
      ], // 10/180 ≈ 5.5%
    });
    expect(result.approachingPreventiveDue).toBe(true);
  });

  it("never compares a remaining value against a mismatched unit's interval", () => {
    // odometer estimate present, but only intervalHourMeter/intervalDays configured
    // (mismatched context) -- must never spuriously flag approaching-due.
    const plansDue: PlanDueResult = {
      isDue: false,
      estimates: [{ kind: "odometer", dueAtValue: 60000, remaining: 1 }],
      nearest: null,
    };
    const result = computePredictiveRisk({
      now,
      healthScore: health(100, "healthy"),
      anomalies: [],
      plans: [
        { result: plansDue, intervalOdometer: null, intervalHourMeter: 500, intervalDays: 180 },
      ],
    });
    expect(result.approachingPreventiveDue).toBe(false);
  });

  it("combines every signal and caps the total score at 100", () => {
    const anomalies: MaintenanceAnomaly[] = Array.from({ length: 5 }, () => ({
      type: "downtime_outlier",
      severity: "high",
      message: "x",
      orderId: null,
      relatedOrderId: null,
    }));
    const plansDue: PlanDueResult = {
      isDue: false,
      estimates: [{ kind: "odometer", dueAtValue: 60000, remaining: 100 }],
      nearest: null,
    };
    const result = computePredictiveRisk({
      now,
      healthScore: health(5, "critical"),
      anomalies,
      plans: [
        { result: plansDue, intervalOdometer: 10000, intervalHourMeter: null, intervalDays: null },
      ],
    });
    expect(result.score).toBe(100); // 95 + 20 + 15 = 130, clamped
    expect(result.tier).toBe("high");
  });

  it("tier boundaries: low <30, moderate 30-59, elevated 60-79, high >=80", () => {
    expect(
      computePredictiveRisk({ now, healthScore: health(75, "attention"), anomalies: [], plans: [] })
        .tier,
    ).toBe("low"); // score 25
    expect(
      computePredictiveRisk({ now, healthScore: health(65, "attention"), anomalies: [], plans: [] })
        .tier,
    ).toBe("moderate"); // score 35
    expect(
      computePredictiveRisk({ now, healthScore: health(35, "critical"), anomalies: [], plans: [] })
        .tier,
    ).toBe("elevated"); // score 65
    expect(
      computePredictiveRisk({ now, healthScore: health(15, "critical"), anomalies: [], plans: [] })
        .tier,
    ).toBe("high"); // score 85
  });
});
