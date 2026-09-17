import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateRentalPrice,
  findApplicableRentalRate,
  checkRentalAvailability,
  createRental,
  createRentalContract,
  RentalConflictError,
  type RentalRate,
} from "../../../lib/rental/rental-service";

// Agent Runtime v3, Wave 2.5 ("Rental Domain Foundation"). Mirrors this
// session's established fake-scope testing style (mutation-registry.test.ts,
// wave3-safe-actions.test.ts) — real domain logic exercised against a
// fake but shape-accurate db, never a live Supabase connection here. The
// one thing that CANNOT be unit-tested this way — the GiST exclusion
// constraint actually rejecting a genuine concurrent double-book — is
// covered by this wave's live verification against the real hosted db
// instead (see this wave's report), not re-derived here.

describe("Wave 2.5 — calculateRentalPrice (pure, deterministic — never the LLM)", () => {
  const rate: RentalRate = {
    id: "rate-1",
    dailyRateCents: 15000,
    hourlyRateCents: 3000,
    weeklyRateCents: 90000,
    monthlyRateCents: 300000,
    currency: "BRL",
  };

  it("a 1-day rental uses the daily rate", () => {
    const result = calculateRentalPrice(rate, "2026-09-18T09:00:00Z", "2026-09-19T09:00:00Z");
    expect(result.totalCents).toBe(15000);
    expect(result.currency).toBe("BRL");
  });

  it("a 3-hour rental (under a day) falls back to the hourly rate", () => {
    const result = calculateRentalPrice(rate, "2026-09-18T09:00:00Z", "2026-09-18T12:00:00Z");
    expect(result.totalCents).toBe(3 * 3000);
  });

  it("a 14-day rental picks the weekly tier because it's genuinely CHEAPER than 14 daily charges (minimum-cost selection, not a fixed threshold)", () => {
    const result = calculateRentalPrice(rate, "2026-09-18T09:00:00Z", "2026-10-02T09:00:00Z");
    // 14 days -> 2 weeks = 180000, vs 14 x daily = 210000 — weekly wins fairly.
    expect(result.totalCents).toBe(2 * 90000);
    expect(result.totalCents).toBeLessThan(14 * 15000);
  });

  it("an 8-day rental picks daily billing instead, because rounding up to 2 FULL weeks would cost the customer MORE than 8 daily charges — this is the real bug a live test caught in an earlier threshold-based version of this function", () => {
    const result = calculateRentalPrice(rate, "2026-09-18T09:00:00Z", "2026-09-26T09:00:00Z");
    expect(result.totalCents).toBe(8 * 15000); // 120000, cheaper than 2 x weekly (180000)
    expect(result.totalCents).toBeLessThan(2 * 90000);
  });

  it("a 30-day rental prefers the monthly tier", () => {
    const result = calculateRentalPrice(rate, "2026-09-18T09:00:00Z", "2026-10-18T09:00:00Z");
    expect(result.totalCents).toBe(300000);
  });

  it("throws (never returns a fabricated 0) when endsAt is not after startsAt", () => {
    expect(() =>
      calculateRentalPrice(rate, "2026-09-18T09:00:00Z", "2026-09-18T09:00:00Z"),
    ).toThrow();
    expect(() =>
      calculateRentalPrice(rate, "2026-09-18T09:00:00Z", "2026-09-17T09:00:00Z"),
    ).toThrow();
  });

  it("throws when the rate plan has no tier at all (never a silent 0-cost rental)", () => {
    const empty: RentalRate = {
      ...rate,
      dailyRateCents: null,
      hourlyRateCents: null,
      weeklyRateCents: null,
      monthlyRateCents: null,
    };
    expect(() =>
      calculateRentalPrice(empty, "2026-09-18T09:00:00Z", "2026-09-19T09:00:00Z"),
    ).toThrow();
  });
});

// Minimal PostgREST-shaped fake — chainable eq/lte/or/is/limit, terminal
// maybeSingle — matching findApplicableRentalRate's real call shape.
function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.eq = self;
  chain.lte = self;
  chain.or = self;
  chain.is = self;
  chain.limit = self;
  chain.maybeSingle = async () => ({ data: result, error: null });
  return chain;
}

describe("Wave 2.5 — findApplicableRentalRate (specificity priority)", () => {
  it("an asset-specific rate wins over a type/category rate", async () => {
    const assetSpecificRate = {
      id: "rate-asset",
      daily_rate_cents: 10000,
      hourly_rate_cents: null,
      weekly_rate_cents: null,
      monthly_rate_cents: null,
      currency: "BRL",
    };
    const db = {
      from: (table: string) => {
        if (table === "assets") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: "asset-1", asset_type_id: "type-1", category: "vehicle" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        // rental_rates — always returns the asset-specific match on the first call
        return { select: () => makeChain(assetSpecificRate) };
      },
    } as unknown as SupabaseClient;

    const rate = await findApplicableRentalRate(db, { tenantId: "t1", assetId: "asset-1" });
    expect(rate?.id).toBe("rate-asset");
  });

  it("returns null (never a fabricated default) when the asset itself doesn't exist for this tenant", async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
      }),
    } as unknown as SupabaseClient;
    const rate = await findApplicableRentalRate(db, { tenantId: "t1", assetId: "missing" });
    expect(rate).toBeNull();
  });
});

describe("Wave 2.5 — checkRentalAvailability / createRental", () => {
  it("available: true when findAssetConflicts (via the operations table) returns no overlapping rows", async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: () => ({
                is: () => ({
                  lt: () => ({ gt: async () => ({ data: [], error: null }) }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await checkRentalAvailability(db, {
      tenantId: "t1",
      assetId: "asset-1",
      startsAt: "2026-09-18T09:00:00Z",
      endsAt: "2026-09-19T09:00:00Z",
    });
    expect(result.available).toBe(true);
  });

  it("createRental throws RentalConflictError (never silently books over an existing reservation) when a conflict exists", async () => {
    const conflict = {
      id: "op-existing",
      type: "vehicle_rental",
      scheduled_starts_at: "2026-09-18T00:00:00Z",
      scheduled_ends_at: "2026-09-20T00:00:00Z",
    };
    const db = {
      from: (table: string) => {
        if (table === "assets") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: "asset-1", branch_id: "branch-1" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        // operations (findAssetConflicts) — returns one conflicting row
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  is: () => ({
                    lt: () => ({ gt: async () => ({ data: [conflict], error: null }) }),
                  }),
                }),
              }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;

    await expect(
      createRental(db, {
        tenantId: "t1",
        assetId: "asset-1",
        scheduledStartsAt: "2026-09-18T09:00:00Z",
        scheduledEndsAt: "2026-09-19T09:00:00Z",
      }),
    ).rejects.toBeInstanceOf(RentalConflictError);
  });

  it("createRental rejects an asset that doesn't belong to this tenant (cross-tenant protection)", async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      createRental(db, {
        tenantId: "t1",
        assetId: "asset-from-another-tenant",
        scheduledStartsAt: "2026-09-18T09:00:00Z",
        scheduledEndsAt: "2026-09-19T09:00:00Z",
      }),
    ).rejects.toThrow(/asset not found/);
  });
});

describe("Wave 2.5 — createRentalContract (reuses the real `contracts` table, never a parallel schema)", () => {
  it("creates a plain contract row with the rental's own data — no blueprintId, no dynamic template resolution attempted", async () => {
    let insertedRow: Record<string, unknown> | null = null;
    const db = {
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          insertedRow = row;
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "contract-1",
                  type: "rental",
                  status: "draft",
                  value_amount: row.value_amount,
                  value_currency: row.value_currency,
                  organization_id: row.organization_id,
                },
                error: null,
              }),
            }),
          };
        },
      }),
    } as unknown as SupabaseClient;

    const contract = await createRentalContract(db, {
      tenantId: "t1",
      organizationId: "org-1",
      valueAmount: 150,
      valueCurrency: "BRL",
      periodStartsAt: "2026-09-18T09:00:00Z",
      periodEndsAt: "2026-09-19T09:00:00Z",
      rentalOperationId: "op-1",
    });

    expect(contract.type).toBe("rental");
    expect(contract.valueAmount).toBe(150);
    expect(
      (insertedRow as unknown as { metadata: { rentalOperationId: string } })?.metadata
        .rentalOperationId,
    ).toBe("op-1");
  });
});
