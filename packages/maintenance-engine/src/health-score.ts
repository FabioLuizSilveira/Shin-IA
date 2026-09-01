import type { MaintenanceOrder, PlanDueResult } from "./types.js";

// Asset Health Score (Etapa 5, P1) — deterministic and versioned, no LLM
// and no ML: same "never invent, never present false precision" discipline
// as resolvePlanDue(). The score starts at 100 and subtracts capped
// deductions for observable signals already produced elsewhere in this
// package/module (overdue preventive plans, corrective/emergency
// frequency, downtime, neglected open orders). Bump
// ASSET_HEALTH_SCORE_VERSION whenever the weights or inputs change so a
// stored/displayed score can always be traced to the formula that
// produced it.
export const ASSET_HEALTH_SCORE_VERSION = 1;

export type AssetHealthBand = "healthy" | "attention" | "critical";

export interface AssetHealthScoreInput {
  overduePlansCount: number;
  correctiveEmergencyOrdersInWindow: number;
  downtimeHoursInWindow: number;
  staleOpenOrdersCount: number;
}

export interface AssetHealthScoreDeductions {
  overduePreventive: number;
  correctiveFrequency: number;
  downtime: number;
  staleOpenOrders: number;
}

export interface AssetHealthScoreResult {
  version: number;
  score: number;
  band: AssetHealthBand;
  deductions: AssetHealthScoreDeductions;
}

const MAX_OVERDUE_DEDUCTION = 40;
const PER_OVERDUE_PLAN = 15;

const MAX_CORRECTIVE_DEDUCTION = 30;
const PER_CORRECTIVE_ORDER = 6;

const MAX_DOWNTIME_DEDUCTION = 20;
const HOURS_PER_DOWNTIME_POINT = 24; // 1 point per full day of downtime, capped
const DOWNTIME_POINT_VALUE = 4;

const MAX_STALE_OPEN_DEDUCTION = 10;
const PER_STALE_OPEN_ORDER = 10;

export function computeAssetHealthScore(input: AssetHealthScoreInput): AssetHealthScoreResult {
  const overduePreventive = Math.min(
    MAX_OVERDUE_DEDUCTION,
    input.overduePlansCount * PER_OVERDUE_PLAN,
  );
  const correctiveFrequency = Math.min(
    MAX_CORRECTIVE_DEDUCTION,
    input.correctiveEmergencyOrdersInWindow * PER_CORRECTIVE_ORDER,
  );
  const downtime = Math.min(
    MAX_DOWNTIME_DEDUCTION,
    Math.floor(input.downtimeHoursInWindow / HOURS_PER_DOWNTIME_POINT) * DOWNTIME_POINT_VALUE,
  );
  const staleOpenOrders = Math.min(
    MAX_STALE_OPEN_DEDUCTION,
    input.staleOpenOrdersCount * PER_STALE_OPEN_ORDER,
  );

  const score = Math.max(
    0,
    Math.min(100, 100 - overduePreventive - correctiveFrequency - downtime - staleOpenOrders),
  );

  let band: AssetHealthBand;
  if (score >= 80) band = "healthy";
  else if (score >= 50) band = "attention";
  else band = "critical";

  return {
    version: ASSET_HEALTH_SCORE_VERSION,
    score,
    band,
    deductions: { overduePreventive, correctiveFrequency, downtime, staleOpenOrders },
  };
}

const STALE_OPEN_STATUSES = new Set(["scheduled", "awaiting_approval", "approved", "in_progress"]);

// Pure aggregation from already-fetched rows into computeAssetHealthScore's
// input shape. DB fetching stays in the API route (house convention); this
// function only ever sees plain arrays so it stays trivially testable.
export function deriveHealthScoreInputs(params: {
  now: Date;
  plansDue: { result: PlanDueResult }[];
  orders: Pick<
    MaintenanceOrder,
    "type" | "status" | "downtimeStart" | "downtimeEnd" | "openedAt"
  >[];
  windowDays?: number;
  staleOpenOrderDays?: number;
}): AssetHealthScoreInput {
  const windowDays = params.windowDays ?? 180;
  const staleOpenOrderDays = params.staleOpenOrderDays ?? 30;

  const windowStart = new Date(params.now);
  windowStart.setDate(windowStart.getDate() - windowDays);

  const overduePlansCount = params.plansDue.filter((p) => p.result.isDue).length;

  const correctiveEmergencyOrdersInWindow = params.orders.filter(
    (o) =>
      (o.type === "corrective" || o.type === "emergency") && new Date(o.openedAt) >= windowStart,
  ).length;

  const downtimeHoursInWindow = params.orders.reduce((sum, o) => {
    if (!o.downtimeStart || !o.downtimeEnd) return sum;
    if (new Date(o.downtimeStart) < windowStart) return sum;
    const hours =
      (new Date(o.downtimeEnd).getTime() - new Date(o.downtimeStart).getTime()) / 3_600_000;
    return sum + Math.max(0, hours);
  }, 0);

  const staleOpenOrdersCount = params.orders.filter((o) => {
    if (!STALE_OPEN_STATUSES.has(o.status)) return false;
    const ageDays = (params.now.getTime() - new Date(o.openedAt).getTime()) / 86_400_000;
    return ageDays > staleOpenOrderDays;
  }).length;

  return {
    overduePlansCount,
    correctiveEmergencyOrdersInWindow,
    downtimeHoursInWindow,
    staleOpenOrdersCount,
  };
}
