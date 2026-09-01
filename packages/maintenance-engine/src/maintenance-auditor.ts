import type { AssetHealthScoreResult } from "./health-score.js";
import type { PredictiveRiskResult } from "./predictive-risk.js";

// Maintenance Auditor (Etapa 14) — periodic/event-driven scan producing
// MaintenanceInsight records. Deliberately deterministic, not an LLM
// call: every input here is already a structured result from this
// package's other pure functions (health score, predictive risk), and
// the auditor's own job is just noticing fleet-wide *patterns* across
// them (a cluster of high-risk assets, a declining average, recommen-
// dations nobody acted on) -- exactly the kind of aggregation an LLM
// would only be doing worse and less reproducibly. No premature
// complex ML, per the spec's own explicit rule.

export type MaintenanceInsightType =
  | "critical_health_asset"
  | "high_risk_cluster"
  | "low_fleet_health"
  | "stale_recommendations";

export type MaintenanceInsightSeverity = "medium" | "high";

export interface MaintenanceInsightDraft {
  type: MaintenanceInsightType;
  severity: MaintenanceInsightSeverity;
  message: string;
  assetId: string | null; // null = fleet-level insight
  // Stable per (tenant, underlying condition) -- the API route upserts on
  // this with ignoreDuplicates, same dedupe discipline as
  // recommendations.ts, so re-running the audit never spams duplicates.
  insightKey: string;
}

export interface FleetAssetSignal {
  assetId: string;
  assetName: string;
  healthScore: AssetHealthScoreResult;
  predictiveRisk: PredictiveRiskResult;
}

const HIGH_RISK_CLUSTER_MIN_ASSETS = 3;
const HIGH_RISK_CLUSTER_MIN_FRACTION = 0.2;
const LOW_FLEET_HEALTH_THRESHOLD = 60;

export function auditFleet(input: {
  assets: FleetAssetSignal[];
  // Precomputed by the caller (a plain "pending and older than 30 days"
  // count query) -- this package never queries a database.
  staleRecommendationsCount: number;
}): MaintenanceInsightDraft[] {
  const drafts: MaintenanceInsightDraft[] = [];

  // ── A. Any asset at critical health -> its own insight ──
  for (const asset of input.assets) {
    if (asset.healthScore.band === "critical") {
      drafts.push({
        type: "critical_health_asset",
        severity: "high",
        message: `Ativo "${asset.assetName}" está com saúde crítica (${asset.healthScore.score}/100)`,
        assetId: asset.assetId,
        insightKey: `critical_health:${asset.assetId}`,
      });
    }
  }

  if (input.assets.length > 0) {
    // ── B. A meaningful cluster of high predictive-risk assets, not just
    // one -- needs both an absolute minimum and a fraction of the fleet,
    // so a 4-asset tenant with 1 high-risk asset never triggers a
    // "cluster" (25% but only 1 asset is one bad asset, not a pattern).
    const highRiskCount = input.assets.filter((a) => a.predictiveRisk.tier === "high").length;
    const fraction = highRiskCount / input.assets.length;
    if (
      highRiskCount >= HIGH_RISK_CLUSTER_MIN_ASSETS &&
      fraction >= HIGH_RISK_CLUSTER_MIN_FRACTION
    ) {
      drafts.push({
        type: "high_risk_cluster",
        severity: "high",
        message: `${highRiskCount} de ${input.assets.length} ativos (${Math.round(fraction * 100)}%) estão em risco preditivo alto`,
        assetId: null,
        insightKey: "high_risk_cluster",
      });
    }

    // ── C. Fleet-wide average health trending low ──
    const avgHealth =
      input.assets.reduce((sum, a) => sum + a.healthScore.score, 0) / input.assets.length;
    if (avgHealth < LOW_FLEET_HEALTH_THRESHOLD) {
      drafts.push({
        type: "low_fleet_health",
        severity: "medium",
        message: `Saúde média da frota em ${avgHealth.toFixed(0)}/100, abaixo do esperado (${LOW_FLEET_HEALTH_THRESHOLD})`,
        assetId: null,
        insightKey: "low_fleet_health",
      });
    }
  }

  // ── D. Recommendations sitting unresolved -- a human hasn't acted ──
  if (input.staleRecommendationsCount > 0) {
    drafts.push({
      type: "stale_recommendations",
      severity: "medium",
      message: `${input.staleRecommendationsCount} recomendação(ões) pendente(s) há mais de 30 dias sem decisão`,
      assetId: null,
      insightKey: "stale_recommendations",
    });
  }

  return drafts;
}
