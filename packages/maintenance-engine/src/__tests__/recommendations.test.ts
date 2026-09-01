import { describe, it, expect } from "vitest";
import { deriveRecommendations } from "../recommendations.js";
import type { AssetHealthScoreResult } from "../health-score.js";
import type { MaintenanceAnomaly } from "../anomaly-detection.js";
import type { PlanDueResult } from "../types.js";

function healthy(): AssetHealthScoreResult {
  return {
    version: 1,
    score: 100,
    band: "healthy",
    deductions: { overduePreventive: 0, correctiveFrequency: 0, downtime: 0, staleOpenOrders: 0 },
  };
}

function due(isDue: boolean): PlanDueResult {
  return { isDue, estimates: [], nearest: null };
}

describe("deriveRecommendations", () => {
  it("returns nothing when every signal is clean", () => {
    const result = deriveRecommendations({ healthScore: healthy(), anomalies: [], plansDue: [] });
    expect(result).toEqual([]);
  });

  it("recommends scheduling only overdue plans, not upcoming ones", () => {
    const result = deriveRecommendations({
      healthScore: healthy(),
      anomalies: [],
      plansDue: [
        { planId: "p1", planName: "Troca de óleo", result: due(true) },
        { planId: "p2", planName: "Rodízio de pneus", result: due(false) },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "schedule_preventive",
      priority: "high",
      sourceType: "maintenance_plan",
      sourceId: "p1",
      dedupeKey: "plan:p1:due",
    });
  });

  it("recommends investigating a high-severity anomaly but ignores medium/low ones", () => {
    const anomalies: MaintenanceAnomaly[] = [
      {
        type: "cost_outlier",
        severity: "high",
        message: "custo muito alto",
        orderId: "order-1",
        relatedOrderId: null,
      },
      {
        type: "recurring_component",
        severity: "medium",
        message: "reincidiu",
        orderId: "order-2",
        relatedOrderId: "order-0",
      },
    ];
    const result = deriveRecommendations({ healthScore: healthy(), anomalies, plansDue: [] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "investigate_anomaly",
      priority: "high",
      sourceId: "order-1",
      dedupeKey: "anomaly:cost_outlier:order-1",
    });
  });

  it("maps a high-severity high_corrective_ratio anomaly to revisit_preventive_plan, not investigate_anomaly", () => {
    const anomalies: MaintenanceAnomaly[] = [
      {
        type: "high_corrective_ratio",
        severity: "high",
        message: "80% corretivas",
        orderId: null, // asset-level, no single order
        relatedOrderId: null,
      },
    ];
    const result = deriveRecommendations({ healthScore: healthy(), anomalies, plansDue: [] });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("revisit_preventive_plan");
    expect(result[0].dedupeKey).toBe("anomaly:high_corrective_ratio:asset");
  });

  it("recommends a full asset review only when the health band is critical", () => {
    const attention = deriveRecommendations({
      healthScore: { ...healthy(), band: "attention", score: 65 },
      anomalies: [],
      plansDue: [],
    });
    expect(attention).toEqual([]);

    const critical = deriveRecommendations({
      healthScore: { ...healthy(), band: "critical", score: 20 },
      anomalies: [],
      plansDue: [],
    });
    expect(critical).toHaveLength(1);
    expect(critical[0]).toMatchObject({
      type: "asset_review",
      priority: "high",
      dedupeKey: "health_score:critical",
    });
  });

  it("combines every signal into one draft list", () => {
    const result = deriveRecommendations({
      healthScore: { ...healthy(), band: "critical", score: 10 },
      anomalies: [
        {
          type: "odometer_regression",
          severity: "high",
          message: "odômetro regrediu",
          orderId: "order-9",
          relatedOrderId: "order-8",
        },
      ],
      plansDue: [{ planId: "p1", planName: "Freios", result: due(true) }],
    });
    expect(result.map((r) => r.type).sort()).toEqual(
      ["asset_review", "investigate_anomaly", "schedule_preventive"].sort(),
    );
  });
});
