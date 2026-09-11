import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeConfigurationDelta, resolveOffboardingPlan } from "./lifecycle.js";

const base = {
  planKey: "starter" as string | null,
  planVersionId: "pv-starter",
  extensions: ["tracking"],
  quotas: { assets: 40, users: 5 },
  commitmentPeriodMonths: 12,
  totalMonthlyCents: 40000,
};

describe("WAVE 5 — configuration delta", () => {
  it("identical configs => no impact", () => {
    const d = computeConfigurationDelta(base, { ...base });
    expect(d.requiresNewContract).toBe(false);
    expect(d.requiresReprovisioning).toBe(false);
    expect(d.reasons).toContain("Sem impacto contratual ou operacional.");
  });

  it("upgrade is material — new contract + reprovision", () => {
    const d = computeConfigurationDelta(base, {
      ...base,
      planKey: "professional",
      planVersionId: "pv-pro",
      totalMonthlyCents: 60000,
    });
    expect(d.planChange?.direction).toBe("up");
    expect(d.priceDeltaCents).toBe(20000);
    expect(d.requiresNewContract).toBe(true);
    expect(d.requiresReprovisioning).toBe(true);
  });

  it("removing an extension is operational-only — reprovision, no new contract", () => {
    const d = computeConfigurationDelta(base, { ...base, extensions: [] });
    expect(d.extensionsRemoved).toEqual(["tracking"]);
    expect(d.requiresNewContract).toBe(false);
    expect(d.requiresReprovisioning).toBe(true);
  });

  it("a price decrease (downgrade) is not material", () => {
    const d = computeConfigurationDelta(base, {
      ...base,
      planKey: "professional",
      totalMonthlyCents: 30000,
    });
    // plan changed => still material because plan direction != same
    expect(d.planChange?.direction).toBe("up");
    // but a pure price drop with same plan is not:
    const d2 = computeConfigurationDelta(base, { ...base, totalMonthlyCents: 30000 });
    expect(d2.requiresNewContract).toBe(false);
    expect(d2.priceDeltaCents).toBe(-10000);
  });

  it("longer commitment is material; shorter is not", () => {
    expect(
      computeConfigurationDelta(base, { ...base, commitmentPeriodMonths: 24 }).requiresNewContract,
    ).toBe(true);
    expect(
      computeConfigurationDelta(base, { ...base, commitmentPeriodMonths: 6 }).requiresNewContract,
    ).toBe(false);
  });

  it("quota growth => reprovision only, and is deterministic", () => {
    const proposed = { ...base, quotas: { assets: 100, users: 5 } };
    const a = computeConfigurationDelta(base, proposed);
    const b = computeConfigurationDelta(base, proposed);
    expect(a.quotaChanges).toEqual([{ key: "assets", from: 40, to: 100 }]);
    expect(a.requiresReprovisioning).toBe(true);
    expect(a.requiresNewContract).toBe(false);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("WAVE 5 — offboarding plan", () => {
  it("resolves from the current published retention policy", async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      version: 2,
                      summary: "Resumo",
                      rules: [{ dataCategory: "contracts", retention: "5 anos", action: "retain" }],
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    const plan = await resolveOffboardingPlan(db);
    expect(plan.retentionPolicyVersion).toBe(2);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].dataCategory).toBe("contracts");
  });
});
