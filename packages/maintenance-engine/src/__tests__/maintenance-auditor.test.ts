import { describe, it, expect } from "vitest";
import { auditFleet, type FleetAssetSignal } from "../maintenance-auditor.js";
import type { AssetHealthScoreResult } from "../health-score.js";
import type { PredictiveRiskResult } from "../predictive-risk.js";

function health(score: number, band: AssetHealthScoreResult["band"]): AssetHealthScoreResult {
  return {
    version: 1,
    score,
    band,
    deductions: { overduePreventive: 0, correctiveFrequency: 0, downtime: 0, staleOpenOrders: 0 },
  };
}

function risk(tier: PredictiveRiskResult["tier"]): PredictiveRiskResult {
  return {
    score: 0,
    tier,
    approachingPreventiveDue: false,
    highSeverityAnomalyCount: 0,
    disclaimer: "x",
  };
}

function asset(overrides: Partial<FleetAssetSignal> = {}): FleetAssetSignal {
  return {
    assetId: crypto.randomUUID(),
    assetName: "Asset",
    healthScore: health(100, "healthy"),
    predictiveRisk: risk("low"),
    ...overrides,
  };
}

describe("auditFleet", () => {
  it("returns nothing for a clean, empty fleet", () => {
    expect(auditFleet({ assets: [], staleRecommendationsCount: 0 })).toEqual([]);
  });

  it("returns nothing for a fully healthy fleet with no stale recommendations", () => {
    const assets = [asset(), asset(), asset()];
    expect(auditFleet({ assets, staleRecommendationsCount: 0 })).toEqual([]);
  });

  it("flags every asset at critical health, one insight each", () => {
    const critical1 = asset({
      assetId: "a1",
      assetName: "Caminhão 1",
      healthScore: health(10, "critical"),
    });
    const critical2 = asset({
      assetId: "a2",
      assetName: "Caminhão 2",
      healthScore: health(5, "critical"),
    });
    const healthy = asset({ healthScore: health(90, "healthy") });
    const drafts = auditFleet({
      assets: [critical1, critical2, healthy],
      staleRecommendationsCount: 0,
    });
    const criticalDrafts = drafts.filter((d) => d.type === "critical_health_asset");
    expect(criticalDrafts).toHaveLength(2);
    expect(criticalDrafts.map((d) => d.assetId).sort()).toEqual(["a1", "a2"]);
    expect(criticalDrafts.every((d) => d.severity === "high")).toBe(true);
  });

  it("never flags a high-risk cluster below the minimum asset count, even at 100% of a tiny fleet", () => {
    // 2 of 2 assets high risk = 100%, but the absolute minimum (3) isn't met.
    const assets = [
      asset({ predictiveRisk: risk("high") }),
      asset({ predictiveRisk: risk("high") }),
    ];
    const drafts = auditFleet({ assets, staleRecommendationsCount: 0 });
    expect(drafts.filter((d) => d.type === "high_risk_cluster")).toEqual([]);
  });

  it("never flags a high-risk cluster below the fraction threshold, even with enough absolute assets", () => {
    // 3 high-risk out of 20 = 15%, below the 20% fraction threshold.
    const assets = [
      ...Array.from({ length: 3 }, () => asset({ predictiveRisk: risk("high") })),
      ...Array.from({ length: 17 }, () => asset({ predictiveRisk: risk("low") })),
    ];
    const drafts = auditFleet({ assets, staleRecommendationsCount: 0 });
    expect(drafts.filter((d) => d.type === "high_risk_cluster")).toEqual([]);
  });

  it("flags a high-risk cluster once both the absolute and fraction thresholds are met", () => {
    const assets = [
      ...Array.from({ length: 3 }, () => asset({ predictiveRisk: risk("high") })),
      ...Array.from({ length: 7 }, () => asset({ predictiveRisk: risk("low") })),
    ]; // 3/10 = 30%
    const drafts = auditFleet({ assets, staleRecommendationsCount: 0 });
    const clusterDrafts = drafts.filter((d) => d.type === "high_risk_cluster");
    expect(clusterDrafts).toHaveLength(1);
    expect(clusterDrafts[0].assetId).toBeNull();
    expect(clusterDrafts[0].insightKey).toBe("high_risk_cluster");
  });

  it("flags low fleet health only when the average drops below the threshold", () => {
    const okAverage = [
      asset({ healthScore: health(70, "attention") }),
      asset({ healthScore: health(70, "attention") }),
    ]; // avg 70
    expect(
      auditFleet({ assets: okAverage, staleRecommendationsCount: 0 }).filter(
        (d) => d.type === "low_fleet_health",
      ),
    ).toEqual([]);

    const lowAverage = [
      asset({ healthScore: health(40, "critical") }),
      asset({ healthScore: health(50, "critical") }),
    ]; // avg 45
    const drafts = auditFleet({ assets: lowAverage, staleRecommendationsCount: 0 });
    expect(drafts.filter((d) => d.type === "low_fleet_health")).toHaveLength(1);
  });

  it("flags stale recommendations only when the count is positive", () => {
    expect(auditFleet({ assets: [], staleRecommendationsCount: 0 })).toEqual([]);
    const drafts = auditFleet({ assets: [], staleRecommendationsCount: 4 });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      type: "stale_recommendations",
      severity: "medium",
      assetId: null,
      insightKey: "stale_recommendations",
    });
    expect(drafts[0].message).toContain("4");
  });

  it("combines every signal into one draft list without cross-contamination", () => {
    const critical = asset({
      assetId: "critical-1",
      healthScore: health(10, "critical"),
      predictiveRisk: risk("high"),
    });
    const assets = [
      critical,
      ...Array.from({ length: 3 }, () => asset({ predictiveRisk: risk("high") })),
      ...Array.from({ length: 6 }, () => asset({ healthScore: health(30, "critical") })),
    ];
    const drafts = auditFleet({ assets, staleRecommendationsCount: 2 });
    const types = new Set(drafts.map((d) => d.type));
    expect(types.has("critical_health_asset")).toBe(true);
    expect(types.has("high_risk_cluster")).toBe(true);
    expect(types.has("low_fleet_health")).toBe(true);
    expect(types.has("stale_recommendations")).toBe(true);
  });
});
