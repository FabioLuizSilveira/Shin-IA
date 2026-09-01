import type { MaintenancePlan, PlanDueResult, DueEstimate } from "./types.js";

// Etapa 3 do spec: "cada 10.000 km ou 12 meses, o que ocorrer primeiro."
// Deliberately never invents a baseline: a plan whose interval is
// configured but whose last-triggered baseline is missing produces NO
// estimate for that dimension, rather than guessing "due now" or "due
// from asset creation" -- same discipline as the Infractions Engine's
// resolveDeadline() (never invents an unsourced deadline). A plan with
// trigger_type "combined" simply evaluates every dimension that has both
// an interval AND a baseline configured, and reports every applicable
// estimate -- "nearest" only ever compares within the SAME unit (never
// ranks km against days against hours as if they were commensurable;
// item 5's "não apresentar falsa precisão" applies here too).
export function resolvePlanDue(
  plan: MaintenancePlan,
  context: { now: Date; currentOdometer: number | null; currentHourMeter: number | null },
): PlanDueResult {
  const estimates: DueEstimate[] = [];

  const wantsDate = plan.triggerType === "date" || plan.triggerType === "combined";
  const wantsOdometer = plan.triggerType === "odometer" || plan.triggerType === "combined";
  const wantsHourMeter = plan.triggerType === "hour_meter" || plan.triggerType === "combined";

  if (wantsDate && plan.intervalDays !== null && plan.lastTriggeredAt) {
    const due = new Date(plan.lastTriggeredAt);
    due.setDate(due.getDate() + plan.intervalDays);
    estimates.push({ kind: "date", dueAt: due.toISOString() });
  }

  if (wantsOdometer && plan.intervalOdometer !== null && plan.lastTriggeredOdometer !== null) {
    const dueAtValue = plan.lastTriggeredOdometer + plan.intervalOdometer;
    const remaining =
      context.currentOdometer !== null ? dueAtValue - context.currentOdometer : undefined;
    estimates.push({ kind: "odometer", dueAtValue, remaining });
  }

  if (wantsHourMeter && plan.intervalHourMeter !== null && plan.lastTriggeredHourMeter !== null) {
    const dueAtValue = plan.lastTriggeredHourMeter + plan.intervalHourMeter;
    const remaining =
      context.currentHourMeter !== null ? dueAtValue - context.currentHourMeter : undefined;
    estimates.push({ kind: "hour_meter", dueAtValue, remaining });
  }

  // trigger_type "condition" produces no computable estimate at all --
  // it's informational (conditionNotes), evaluated by a human, not a due
  // date/counter this function could ever derive.

  const isDue = estimates.some((e) => {
    if (e.kind === "date") return e.dueAt !== undefined && new Date(e.dueAt) <= context.now;
    return e.remaining !== undefined && e.remaining <= 0;
  });

  const nearestDue = estimates.find((e) => {
    if (e.kind === "date") return e.dueAt !== undefined && new Date(e.dueAt) <= context.now;
    return e.remaining !== undefined && e.remaining <= 0;
  });

  return { isDue, estimates, nearest: nearestDue ?? null };
}

export function resolveFleetPlansDue(
  plans: MaintenancePlan[],
  context: { now: Date; currentOdometer: number | null; currentHourMeter: number | null },
): { plan: MaintenancePlan; result: PlanDueResult }[] {
  return plans
    .filter((p) => p.active)
    .map((plan) => ({ plan, result: resolvePlanDue(plan, context) }));
}
