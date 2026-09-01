import { describe, it, expect } from "vitest";
import {
  computeAssetHealthScore,
  deriveHealthScoreInputs,
  ASSET_HEALTH_SCORE_VERSION,
} from "../health-score.js";
import type { MaintenanceOrder, PlanDueResult } from "../types.js";

describe("computeAssetHealthScore", () => {
  it("returns a perfect score and healthy band with no negative signals", () => {
    const result = computeAssetHealthScore({
      overduePlansCount: 0,
      correctiveEmergencyOrdersInWindow: 0,
      downtimeHoursInWindow: 0,
      staleOpenOrdersCount: 0,
    });
    expect(result).toEqual({
      version: ASSET_HEALTH_SCORE_VERSION,
      score: 100,
      band: "healthy",
      deductions: {
        overduePreventive: 0,
        correctiveFrequency: 0,
        downtime: 0,
        staleOpenOrders: 0,
      },
    });
  });

  it("deducts 15 points per overdue plan, capped at 40", () => {
    expect(
      computeAssetHealthScore({
        overduePlansCount: 1,
        correctiveEmergencyOrdersInWindow: 0,
        downtimeHoursInWindow: 0,
        staleOpenOrdersCount: 0,
      }).deductions.overduePreventive,
    ).toBe(15);

    expect(
      computeAssetHealthScore({
        overduePlansCount: 10,
        correctiveEmergencyOrdersInWindow: 0,
        downtimeHoursInWindow: 0,
        staleOpenOrdersCount: 0,
      }).deductions.overduePreventive,
    ).toBe(40);
  });

  it("deducts 6 points per corrective/emergency order in window, capped at 30", () => {
    expect(
      computeAssetHealthScore({
        overduePlansCount: 0,
        correctiveEmergencyOrdersInWindow: 3,
        downtimeHoursInWindow: 0,
        staleOpenOrdersCount: 0,
      }).deductions.correctiveFrequency,
    ).toBe(18);

    expect(
      computeAssetHealthScore({
        overduePlansCount: 0,
        correctiveEmergencyOrdersInWindow: 20,
        downtimeHoursInWindow: 0,
        staleOpenOrdersCount: 0,
      }).deductions.correctiveFrequency,
    ).toBe(30);
  });

  it("deducts 4 points per full day of downtime, capped at 20", () => {
    expect(
      computeAssetHealthScore({
        overduePlansCount: 0,
        correctiveEmergencyOrdersInWindow: 0,
        downtimeHoursInWindow: 23, // less than a full day -> no deduction yet
        staleOpenOrdersCount: 0,
      }).deductions.downtime,
    ).toBe(0);

    expect(
      computeAssetHealthScore({
        overduePlansCount: 0,
        correctiveEmergencyOrdersInWindow: 0,
        downtimeHoursInWindow: 48, // 2 full days
        staleOpenOrdersCount: 0,
      }).deductions.downtime,
    ).toBe(8);

    expect(
      computeAssetHealthScore({
        overduePlansCount: 0,
        correctiveEmergencyOrdersInWindow: 0,
        downtimeHoursInWindow: 999,
        staleOpenOrdersCount: 0,
      }).deductions.downtime,
    ).toBe(20);
  });

  it("deducts 10 points per stale open order, capped at 10", () => {
    expect(
      computeAssetHealthScore({
        overduePlansCount: 0,
        correctiveEmergencyOrdersInWindow: 0,
        downtimeHoursInWindow: 0,
        staleOpenOrdersCount: 5,
      }).deductions.staleOpenOrders,
    ).toBe(10);
  });

  it("floors the total score at 0, never negative", () => {
    const result = computeAssetHealthScore({
      overduePlansCount: 10,
      correctiveEmergencyOrdersInWindow: 20,
      downtimeHoursInWindow: 999,
      staleOpenOrdersCount: 5,
    });
    expect(result.score).toBe(0);
    expect(result.band).toBe("critical");
  });

  it("bands: healthy >=80, attention 50-79, critical <50", () => {
    expect(
      computeAssetHealthScore({
        overduePlansCount: 0,
        correctiveEmergencyOrdersInWindow: 0,
        downtimeHoursInWindow: 0,
        staleOpenOrdersCount: 2,
      }).band,
    ).toBe("healthy"); // 100 - 20 = 80

    expect(
      computeAssetHealthScore({
        overduePlansCount: 1,
        correctiveEmergencyOrdersInWindow: 3,
        downtimeHoursInWindow: 0,
        staleOpenOrdersCount: 0,
      }).band,
    ).toBe("attention"); // 100 - 15 - 18 = 67

    expect(
      computeAssetHealthScore({
        overduePlansCount: 2,
        correctiveEmergencyOrdersInWindow: 5,
        downtimeHoursInWindow: 48,
        staleOpenOrdersCount: 1,
      }).band,
    ).toBe("critical"); // 100 - 30 - 30 - 8 - 10 = 22
  });
});

function order(
  overrides: Partial<MaintenanceOrder> = {},
): Pick<MaintenanceOrder, "type" | "status" | "downtimeStart" | "downtimeEnd" | "openedAt"> {
  return {
    type: "corrective",
    status: "completed",
    downtimeStart: null,
    downtimeEnd: null,
    openedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function due(isDue: boolean): { result: PlanDueResult } {
  return { result: { isDue, estimates: [], nearest: null } };
}

describe("deriveHealthScoreInputs", () => {
  const now = new Date("2026-08-01T00:00:00Z");

  it("counts only isDue plans as overdue", () => {
    const result = deriveHealthScoreInputs({
      now,
      plansDue: [due(true), due(false), due(true)],
      orders: [],
    });
    expect(result.overduePlansCount).toBe(2);
  });

  it("counts corrective/emergency orders inside the window, ignores preventive and out-of-window", () => {
    const result = deriveHealthScoreInputs({
      now,
      plansDue: [],
      orders: [
        order({ type: "corrective", openedAt: "2026-07-01T00:00:00Z" }), // in window
        order({ type: "emergency", openedAt: "2026-07-15T00:00:00Z" }), // in window
        order({ type: "preventive", openedAt: "2026-07-15T00:00:00Z" }), // excluded: not corrective/emergency
        order({ type: "corrective", openedAt: "2025-01-01T00:00:00Z" }), // excluded: outside 180-day window
      ],
    });
    expect(result.correctiveEmergencyOrdersInWindow).toBe(2);
  });

  it("sums downtime hours only for orders with downtime inside the window", () => {
    const result = deriveHealthScoreInputs({
      now,
      plansDue: [],
      orders: [
        order({
          openedAt: "2026-07-01T00:00:00Z",
          downtimeStart: "2026-07-01T00:00:00Z",
          downtimeEnd: "2026-07-03T00:00:00Z", // 48h
        }),
        order({
          openedAt: "2025-01-01T00:00:00Z",
          downtimeStart: "2025-01-01T00:00:00Z",
          downtimeEnd: "2025-01-05T00:00:00Z", // outside window -> excluded
        }),
        order({ openedAt: "2026-07-01T00:00:00Z" }), // no downtime recorded
      ],
    });
    expect(result.downtimeHoursInWindow).toBe(48);
  });

  it("flags an open order as stale only once it exceeds the configured age", () => {
    const result = deriveHealthScoreInputs({
      now,
      plansDue: [],
      orders: [
        order({ status: "in_progress", openedAt: "2026-06-01T00:00:00Z" }), // 61 days old -> stale
        order({ status: "scheduled", openedAt: "2026-07-20T00:00:00Z" }), // 12 days old -> not stale
        order({ status: "completed", openedAt: "2026-01-01T00:00:00Z" }), // terminal status -> never stale
      ],
    });
    expect(result.staleOpenOrdersCount).toBe(1);
  });

  it("never invents an estimate: an empty plans/orders set yields an all-zero, perfect-score input", () => {
    const result = deriveHealthScoreInputs({ now, plansDue: [], orders: [] });
    expect(result).toEqual({
      overduePlansCount: 0,
      correctiveEmergencyOrdersInWindow: 0,
      downtimeHoursInWindow: 0,
      staleOpenOrdersCount: 0,
    });
  });
});
