import type { AssetHealthScoreResult } from "./health-score.js";
import type { MaintenanceAnomaly } from "./anomaly-detection.js";
import type { PlanDueResult } from "./types.js";

// Recommendations (Etapa 7, P1) — deterministic, rule-based, human-in-the
// loop (a draft is only ever a suggestion; nothing here writes or acts on
// its own). The spec asks this to reuse the Rule Engine; that package was
// confirmed deleted from this repo (not archived -- see
// docs/modules/MAINTENANCE.md), so these rules live directly here,
// following the same house pattern as everywhere else in this module.
//
// This module only ever *drafts* recommendations from already-computed
// signals (health score, anomalies, preventive due status) -- it never
// touches persistence, accept/dismiss state, or dedup. That's the API
// route's job (packages don't own DB access, house convention).

export type RecommendationType =
  | "schedule_preventive"
  | "investigate_anomaly"
  | "asset_review"
  | "revisit_preventive_plan";

export type RecommendationPriority = "low" | "medium" | "high";

export interface RecommendationDraft {
  type: RecommendationType;
  priority: RecommendationPriority;
  message: string;
  sourceType: string | null;
  sourceId: string | null;
  // Stable per underlying signal -- the API route uses this to dedupe
  // against maintenance_recommendations so a recompute never spawns a
  // second row (and never overwrites a past accept/dismiss decision).
  dedupeKey: string;
}

export interface DeriveRecommendationsInput {
  healthScore: AssetHealthScoreResult;
  anomalies: MaintenanceAnomaly[];
  plansDue: { planId: string; planName: string; result: PlanDueResult }[];
}

export function deriveRecommendations(input: DeriveRecommendationsInput): RecommendationDraft[] {
  const drafts: RecommendationDraft[] = [];

  // ── A. Overdue preventive plans -> schedule it ──
  for (const { planId, planName, result } of input.plansDue) {
    if (!result.isDue) continue;
    drafts.push({
      type: "schedule_preventive",
      priority: "high",
      message: `Agendar manutenção preventiva "${planName}" -- já está vencida`,
      sourceType: "maintenance_plan",
      sourceId: planId,
      dedupeKey: `plan:${planId}:due`,
    });
  }

  // ── B. High-severity anomalies -> investigate ──
  for (const anomaly of input.anomalies) {
    if (anomaly.severity !== "high") continue;
    const dedupeKey = anomaly.orderId
      ? `anomaly:${anomaly.type}:${anomaly.orderId}`
      : `anomaly:${anomaly.type}:asset`; // asset-level anomalies (e.g. high_corrective_ratio) have no orderId
    drafts.push({
      type:
        anomaly.type === "high_corrective_ratio"
          ? "revisit_preventive_plan"
          : "investigate_anomaly",
      priority: "high",
      message: anomaly.message,
      sourceType: "maintenance_anomaly",
      sourceId: anomaly.orderId,
      dedupeKey,
    });
  }

  // ── C. Critical health score -> full asset review ──
  if (input.healthScore.band === "critical") {
    drafts.push({
      type: "asset_review",
      priority: "high",
      message: `Saúde do ativo em ${input.healthScore.score}/100 (crítico) -- recomenda-se uma revisão completa`,
      sourceType: "health_score",
      sourceId: null,
      dedupeKey: "health_score:critical",
    });
  }

  return drafts;
}
