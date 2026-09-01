import type { AssetHealthScoreResult } from "./health-score.js";
import type { MaintenanceAnomaly } from "./anomaly-detection.js";
import type { PlanDueResult } from "./types.js";

// Predictive Risk foundation (Etapa 8, P2). The spec is explicit: "risk
// estimate, not failure certainty" -- this is deterministic arithmetic
// over signals this module already computes (health score, anomalies,
// preventive due proximity), never a trained model or a probability of
// failure. NÃO FAZER item 7 ("no premature complex ML") applies directly
// here: this is the simplest thing that can honestly be called a risk
// foundation, nothing more.

export type PredictiveRiskTier = "low" | "moderate" | "elevated" | "high";

export interface PredictiveRiskResult {
  score: number; // 0-100, higher = more risk. Not a probability.
  tier: PredictiveRiskTier;
  approachingPreventiveDue: boolean;
  highSeverityAnomalyCount: number;
  disclaimer: string;
}

export const PREDICTIVE_RISK_DISCLAIMER =
  "Estimativa de risco com base em sinais históricos (saúde do ativo, anomalias, proximidade de manutenção preventiva) -- não é uma previsão de falha nem uma probabilidade estatística.";

export interface PredictiveRiskPlanContext {
  result: PlanDueResult;
  intervalOdometer: number | null;
  intervalHourMeter: number | null;
  intervalDays: number | null;
}

// "Approaching due" -- within 15% of the plan's own interval, but not yet
// due (an already-due plan is health score's job, not this one's). Same
// "never compare across incompatible units" discipline as resolvePlanDue:
// each dimension is only ever checked against its own interval.
const APPROACHING_THRESHOLD_FRACTION = 0.15;

function isApproachingDue(ctx: PredictiveRiskPlanContext, now: Date): boolean {
  return ctx.result.estimates.some((e) => {
    if (e.kind === "odometer" && ctx.intervalOdometer && e.remaining !== undefined) {
      return (
        e.remaining > 0 && e.remaining <= ctx.intervalOdometer * APPROACHING_THRESHOLD_FRACTION
      );
    }
    if (e.kind === "hour_meter" && ctx.intervalHourMeter && e.remaining !== undefined) {
      return (
        e.remaining > 0 && e.remaining <= ctx.intervalHourMeter * APPROACHING_THRESHOLD_FRACTION
      );
    }
    if (e.kind === "date" && ctx.intervalDays && e.dueAt) {
      const daysRemaining = (new Date(e.dueAt).getTime() - now.getTime()) / 86_400_000;
      return (
        daysRemaining > 0 && daysRemaining <= ctx.intervalDays * APPROACHING_THRESHOLD_FRACTION
      );
    }
    return false;
  });
}

const HEALTH_COMPLEMENT_WEIGHT = 1; // 100 - health score, taken as-is
const MAX_ANOMALY_CONTRIBUTION = 20;
const PER_HIGH_ANOMALY = 10;
const APPROACHING_DUE_CONTRIBUTION = 15;

export function computePredictiveRisk(input: {
  now: Date;
  healthScore: AssetHealthScoreResult;
  anomalies: MaintenanceAnomaly[];
  plans: PredictiveRiskPlanContext[];
}): PredictiveRiskResult {
  const highSeverityAnomalyCount = input.anomalies.filter((a) => a.severity === "high").length;
  const approachingPreventiveDue = input.plans.some((p) => isApproachingDue(p, input.now));

  const score = Math.max(
    0,
    Math.min(
      100,
      HEALTH_COMPLEMENT_WEIGHT * (100 - input.healthScore.score) +
        Math.min(MAX_ANOMALY_CONTRIBUTION, highSeverityAnomalyCount * PER_HIGH_ANOMALY) +
        (approachingPreventiveDue ? APPROACHING_DUE_CONTRIBUTION : 0),
    ),
  );

  let tier: PredictiveRiskTier;
  if (score >= 80) tier = "high";
  else if (score >= 60) tier = "elevated";
  else if (score >= 30) tier = "moderate";
  else tier = "low";

  return {
    score,
    tier,
    approachingPreventiveDue,
    highSeverityAnomalyCount,
    disclaimer: PREDICTIVE_RISK_DISCLAIMER,
  };
}
