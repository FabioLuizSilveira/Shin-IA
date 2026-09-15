import { describe, expect, it } from "vitest";
import { generateTripInstances, type RecurringServicePlan } from "./recurring-plan-service";

// WAVE 3 — spec section 16's own warning: "Evitar explosão de registros sem
// necessidade" — generateTripInstances must only ever produce instances
// within the requested horizon, never for the plan's whole lifetime.

function basePlan(overrides: Partial<RecurringServicePlan> = {}): RecurringServicePlan {
  return {
    id: "plan-1",
    tenantId: "t1",
    operationProfileId: null,
    routeId: "route-1",
    customerOrganizationId: "org-1",
    schedule: [],
    startsOn: "2026-01-01",
    endsOn: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("generateTripInstances", () => {
  it("only generates instances within the requested horizon", () => {
    // Monday 06:00 + Wednesday 14:00, weekly — 2 weeks horizon should
    // produce exactly 4 instances, never the whole plan lifetime.
    const plan = basePlan({
      schedule: [
        { dayOfWeek: 1, departureTime: "06:00" }, // Monday
        { dayOfWeek: 3, departureTime: "14:00" }, // Wednesday
      ],
    });
    // 2026-01-05 is a Monday.
    const from = new Date("2026-01-05T00:00:00");
    const instances = generateTripInstances(plan, { from, horizonDays: 14 });
    expect(instances).toHaveLength(4);
  });

  it("respects a non-positive horizon by generating nothing", () => {
    const plan = basePlan({ schedule: [{ dayOfWeek: 1, departureTime: "06:00" }] });
    expect(
      generateTripInstances(plan, { from: new Date("2026-01-05"), horizonDays: 0 }),
    ).toHaveLength(0);
  });

  it("never generates instances before the plan's startsOn", () => {
    const plan = basePlan({
      startsOn: "2026-01-10",
      schedule: [{ dayOfWeek: 1, departureTime: "06:00" }],
    });
    const from = new Date("2026-01-05T00:00:00"); // before startsOn
    const instances = generateTripInstances(plan, { from, horizonDays: 7 });
    for (const inst of instances) {
      expect(new Date(inst.scheduledStartsAt).getTime()).toBeGreaterThanOrEqual(
        new Date("2026-01-10T00:00:00").getTime(),
      );
    }
  });

  it("never generates instances after the plan's endsOn", () => {
    const plan = basePlan({
      startsOn: "2026-01-01",
      endsOn: "2026-01-06",
      schedule: [
        { dayOfWeek: 1, departureTime: "06:00" },
        { dayOfWeek: 2, departureTime: "06:00" },
      ],
    });
    const from = new Date("2026-01-05T00:00:00");
    const instances = generateTripInstances(plan, { from, horizonDays: 14 });
    for (const inst of instances) {
      expect(new Date(inst.scheduledStartsAt).getTime()).toBeLessThanOrEqual(
        new Date("2026-01-06T23:59:59").getTime(),
      );
    }
  });

  it("a paused or ended plan generates nothing", () => {
    const plan = basePlan({
      status: "paused",
      schedule: [{ dayOfWeek: 1, departureTime: "06:00" }],
    });
    expect(
      generateTripInstances(plan, { from: new Date("2026-01-05"), horizonDays: 30 }),
    ).toHaveLength(0);
    const ended = basePlan({
      status: "ended",
      schedule: [{ dayOfWeek: 1, departureTime: "06:00" }],
    });
    expect(
      generateTripInstances(ended, { from: new Date("2026-01-05"), horizonDays: 30 }),
    ).toHaveLength(0);
  });

  it("uses estimatedArrivalTime when given, and defaults to a 60-minute window otherwise", () => {
    const plan = basePlan({
      schedule: [
        { dayOfWeek: 1, departureTime: "06:00", estimatedArrivalTime: "07:30" },
        { dayOfWeek: 3, departureTime: "14:00" },
      ],
    });
    const from = new Date("2026-01-05T00:00:00"); // Monday
    const [monday, wednesday] = generateTripInstances(plan, { from, horizonDays: 7 });
    const mondayDurationMin =
      (new Date(monday.scheduledEndsAt).getTime() - new Date(monday.scheduledStartsAt).getTime()) /
      60000;
    expect(mondayDurationMin).toBe(90);
    const wedDurationMin =
      (new Date(wednesday.scheduledEndsAt).getTime() -
        new Date(wednesday.scheduledStartsAt).getTime()) /
      60000;
    expect(wedDurationMin).toBe(60);
  });

  it("scheduled_starts_at is always strictly before scheduled_ends_at (matches the DB check constraint)", () => {
    const plan = basePlan({
      schedule: [{ dayOfWeek: 1, departureTime: "06:00", estimatedArrivalTime: "05:00" }], // bogus "arrival before departure"
    });
    const [inst] = generateTripInstances(plan, {
      from: new Date("2026-01-05T00:00:00"),
      horizonDays: 1,
    });
    expect(new Date(inst.scheduledEndsAt).getTime()).toBeGreaterThan(
      new Date(inst.scheduledStartsAt).getTime(),
    );
  });
});
