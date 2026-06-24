import { describe, it, expect } from "vitest";
import { scoreLead, groupByStage, filterByStatus, computePipelineValue } from "../../lib/crm.js";
import type { Lead } from "../../lib/types.js";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    name: "Test Lead",
    stage: "prospect",
    status: "active",
    estimatedRevenue: 1000,
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("scoreLead", () => {
  it("scores negotiation stage highest among base stages", () => {
    const score = scoreLead(makeLead({ stage: "negotiation" }));
    expect(score).toBeGreaterThan(scoreLead(makeLead({ stage: "proposal" })));
  });

  it("scores proposal > qualified > prospect", () => {
    const proposal = scoreLead(makeLead({ stage: "proposal", estimatedRevenue: 100 }));
    const qualified = scoreLead(makeLead({ stage: "qualified", estimatedRevenue: 100 }));
    const prospect = scoreLead(makeLead({ stage: "prospect", estimatedRevenue: 100 }));
    expect(proposal).toBeGreaterThan(qualified);
    expect(qualified).toBeGreaterThan(prospect);
  });

  it("adds bonus for revenue >= 10000", () => {
    const highRevenue = scoreLead(makeLead({ estimatedRevenue: 100_000 }));
    const lowRevenue = scoreLead(makeLead({ estimatedRevenue: 500 }));
    expect(highRevenue).toBeGreaterThan(lowRevenue);
  });

  it("adds bonus for revenue in 5000-9999 range", () => {
    const mid = scoreLead(makeLead({ estimatedRevenue: 7000 }));
    const low = scoreLead(makeLead({ estimatedRevenue: 100 }));
    expect(mid).toBeGreaterThan(low);
  });

  it("adds bonus for revenue in 1000-4999 range", () => {
    const r1000 = scoreLead(makeLead({ estimatedRevenue: 1000 }));
    const r100 = scoreLead(makeLead({ estimatedRevenue: 100 }));
    expect(r1000).toBeGreaterThan(r100);
  });

  it("adds status bonus for active leads", () => {
    const active = scoreLead(makeLead({ status: "active" }));
    const inactive = scoreLead(makeLead({ status: "inactive" }));
    expect(active).toBeGreaterThan(inactive);
  });

  it("returns non-negative for closed_won", () => {
    expect(scoreLead(makeLead({ stage: "closed_won" }))).toBeGreaterThanOrEqual(0);
  });

  it("returns non-negative for closed_lost", () => {
    expect(scoreLead(makeLead({ stage: "closed_lost" }))).toBeGreaterThanOrEqual(0);
  });

  it("caps score at 100", () => {
    const score = scoreLead(
      makeLead({ stage: "negotiation", estimatedRevenue: 100_000, status: "active" }),
    );
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("groupByStage", () => {
  it("groups leads by all stages", () => {
    const leads = [
      makeLead({ stage: "prospect" }),
      makeLead({ id: "l2", stage: "qualified" }),
      makeLead({ id: "l3", stage: "proposal" }),
      makeLead({ id: "l4", stage: "negotiation" }),
      makeLead({ id: "l5", stage: "closed_won" }),
      makeLead({ id: "l6", stage: "closed_lost" }),
    ];
    const groups = groupByStage(leads);
    expect(groups.prospect).toHaveLength(1);
    expect(groups.qualified).toHaveLength(1);
    expect(groups.proposal).toHaveLength(1);
    expect(groups.negotiation).toHaveLength(1);
    expect(groups.closed_won).toHaveLength(1);
    expect(groups.closed_lost).toHaveLength(1);
  });

  it("returns empty arrays for missing stages", () => {
    const groups = groupByStage([]);
    expect(groups.prospect).toHaveLength(0);
    expect(groups.closed_won).toHaveLength(0);
  });
});

describe("filterByStatus", () => {
  it("filters to active only", () => {
    const leads = [makeLead({ status: "active" }), makeLead({ id: "l2", status: "inactive" })];
    expect(filterByStatus(leads, "active")).toHaveLength(1);
  });

  it("returns empty when no match", () => {
    expect(filterByStatus([makeLead({ status: "active" })], "inactive")).toHaveLength(0);
  });
});

describe("computePipelineValue", () => {
  it("returns 0 for empty", () => {
    expect(computePipelineValue([])).toBe(0);
  });

  it("excludes closed_lost leads", () => {
    const leads = [
      makeLead({ estimatedRevenue: 1000 }),
      makeLead({ id: "l2", stage: "closed_lost", estimatedRevenue: 5000 }),
    ];
    expect(computePipelineValue(leads)).toBe(1000);
  });

  it("includes closed_won in value", () => {
    const leads = [
      makeLead({ stage: "closed_won", estimatedRevenue: 2000 }),
      makeLead({ id: "l2", stage: "prospect", estimatedRevenue: 1000 }),
    ];
    expect(computePipelineValue(leads)).toBe(3000);
  });
});
