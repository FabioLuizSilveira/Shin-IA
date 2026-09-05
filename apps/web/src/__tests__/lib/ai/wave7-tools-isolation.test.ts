import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssetHealthScoreTool } from "../../../lib/ai/tools/intelligence";
import type { AgentContext } from "../../../lib/ai/agent-context";
import type { TenantScope } from "../../../lib/tenant-context";

interface Row {
  [key: string]: unknown;
}
type Predicate = (row: Row) => boolean;

class FakeQuery implements PromiseLike<{ data: Row[]; error: null }> {
  private filters: Predicate[] = [];
  constructor(private rows: Row[]) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (r[col] ?? null) === val);
    return this;
  }
  async maybeSingle() {
    const found = this.rows.filter((r) => this.filters.every((f) => f(r)));
    return { data: found[0] ?? null, error: null };
  }
  then<TResult1, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    const found = this.rows.filter((r) => this.filters.every((f) => f(r)));
    return Promise.resolve(
      onfulfilled ? onfulfilled({ data: found, error: null }) : (undefined as never),
    );
  }
}

function makeDb(tables: Record<string, Row[]>): SupabaseClient {
  return {
    from: (table: string) => new FakeQuery(tables[table] ?? []),
  } as unknown as SupabaseClient;
}

function makeCtx(tenantId: string): AgentContext {
  return {
    tenantId,
    userId: "user-" + tenantId,
    tenantRole: "operator",
    permissions: ["tenant.maintenance.view"],
    entitlements: { active: true, features: [], planKey: null },
    persona: "operator",
    authenticationLevel: "AAL1",
    currentModule: null,
    currentResource: null,
    aiBudget: { balance: 100, currency: "credits" },
    workspaceId: tenantId,
  };
}

describe("get_asset_health_score — cross-tenant isolation", () => {
  it("returns not-found for an asset belonging to a DIFFERENT tenant", async () => {
    const db = makeDb({ assets: [{ id: "asset-A", tenant_id: "tenant-A" }] });
    const scope: TenantScope = {
      tenantId: "tenant-B",
      userId: "user-b",
      tenantRole: "operator",
      isImpersonating: false,
      accessMode: "full",
      db,
    };
    const result = await getAssetHealthScoreTool.execute(
      { assetId: "asset-A" },
      makeCtx("tenant-B"),
      scope,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("succeeds for an asset that really belongs to this tenant, with no maintenance history", async () => {
    const db = makeDb({
      assets: [{ id: "asset-B", tenant_id: "tenant-B", odometer: 1000, hour_meter: null }],
      maintenance_orders: [],
      maintenance_plans: [],
    });
    const scope: TenantScope = {
      tenantId: "tenant-B",
      userId: "user-b",
      tenantRole: "operator",
      isImpersonating: false,
      accessMode: "full",
      db,
    };
    const result = await getAssetHealthScoreTool.execute(
      { assetId: "asset-B" },
      makeCtx("tenant-B"),
      scope,
    );
    expect(result.ok).toBe(true);
    expect((result.data as { score: number }).score).toBeGreaterThanOrEqual(0);
  });
});
