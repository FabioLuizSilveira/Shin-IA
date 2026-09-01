import { describe, it, expect } from "vitest";
import { resolvePlanDue, resolveFleetPlansDue } from "../preventive.js";
import type { MaintenancePlan } from "../types.js";

function basePlan(overrides: Partial<MaintenancePlan> = {}): MaintenancePlan {
  return {
    id: "plan-1",
    tenantId: "tenant-1",
    assetId: "asset-1",
    assetTypeId: null,
    name: "Troca de óleo",
    triggerType: "odometer",
    intervalDays: null,
    intervalOdometer: null,
    intervalHourMeter: null,
    conditionNotes: null,
    lastTriggeredAt: null,
    lastTriggeredOdometer: null,
    lastTriggeredHourMeter: null,
    active: true,
    ...overrides,
  };
}

const now = new Date("2026-06-15T00:00:00Z");

describe("resolvePlanDue", () => {
  it("never invents a baseline -- no lastTriggeredOdometer means no estimate at all", () => {
    const plan = basePlan({ triggerType: "odometer", intervalOdometer: 10000 });
    const result = resolvePlanDue(plan, { now, currentOdometer: 55000, currentHourMeter: null });
    expect(result.estimates).toHaveLength(0);
    expect(result.isDue).toBe(false);
    expect(result.nearest).toBeNull();
  });

  it("odometer trigger: not due when remaining distance is positive", () => {
    const plan = basePlan({
      triggerType: "odometer",
      intervalOdometer: 10000,
      lastTriggeredOdometer: 50000,
    });
    const result = resolvePlanDue(plan, { now, currentOdometer: 55000, currentHourMeter: null });
    expect(result.estimates).toEqual([{ kind: "odometer", dueAtValue: 60000, remaining: 5000 }]);
    expect(result.isDue).toBe(false);
  });

  it("odometer trigger: due once current odometer reaches the threshold", () => {
    const plan = basePlan({
      triggerType: "odometer",
      intervalOdometer: 10000,
      lastTriggeredOdometer: 50000,
    });
    const result = resolvePlanDue(plan, { now, currentOdometer: 60500, currentHourMeter: null });
    expect(result.isDue).toBe(true);
    expect(result.nearest?.kind).toBe("odometer");
  });

  it("hour_meter trigger works the same way", () => {
    const plan = basePlan({
      triggerType: "hour_meter",
      intervalHourMeter: 500,
      lastTriggeredHourMeter: 1000,
    });
    const dueSoon = resolvePlanDue(plan, { now, currentOdometer: null, currentHourMeter: 1490 });
    expect(dueSoon.isDue).toBe(false);
    const due = resolvePlanDue(plan, { now, currentOdometer: null, currentHourMeter: 1500 });
    expect(due.isDue).toBe(true);
  });

  it("date trigger: due once the interval has elapsed since the baseline", () => {
    const plan = basePlan({
      triggerType: "date",
      intervalDays: 180,
      lastTriggeredAt: "2026-01-01T00:00:00Z",
    });
    const notYet = resolvePlanDue(plan, {
      now: new Date("2026-03-01T00:00:00Z"),
      currentOdometer: null,
      currentHourMeter: null,
    });
    expect(notYet.isDue).toBe(false);
    const due = resolvePlanDue(plan, {
      now: new Date("2026-07-15T00:00:00Z"),
      currentOdometer: null,
      currentHourMeter: null,
    });
    expect(due.isDue).toBe(true);
  });

  it("combined trigger: whichever comes first -- due if EITHER dimension says due", () => {
    const plan = basePlan({
      triggerType: "combined",
      intervalOdometer: 10000,
      lastTriggeredOdometer: 50000,
      intervalDays: 365,
      lastTriggeredAt: "2026-01-01T00:00:00Z",
    });
    // Odometer already due, date isn't yet.
    const result = resolvePlanDue(plan, {
      now: new Date("2026-02-01T00:00:00Z"),
      currentOdometer: 61000,
      currentHourMeter: null,
    });
    expect(result.estimates).toHaveLength(2);
    expect(result.isDue).toBe(true);
  });

  it("condition trigger never produces a computable estimate", () => {
    const plan = basePlan({ triggerType: "condition", conditionNotes: "Verificar visualmente" });
    const result = resolvePlanDue(plan, { now, currentOdometer: 999999, currentHourMeter: 999999 });
    expect(result.estimates).toHaveLength(0);
    expect(result.isDue).toBe(false);
  });

  it("inactive plans are excluded by resolveFleetPlansDue", () => {
    const plans = [basePlan({ id: "a", active: true }), basePlan({ id: "b", active: false })];
    const results = resolveFleetPlansDue(plans, { now, currentOdometer: 0, currentHourMeter: 0 });
    expect(results).toHaveLength(1);
    expect(results[0].plan.id).toBe("a");
  });
});
