import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssetTool, getAssetAvailabilityTool } from "../../../lib/ai/tools/assets";
import { getContractTool, getCustomerContractsTool } from "../../../lib/ai/tools/contracts";
import { getMaintenanceOrderTool } from "../../../lib/ai/tools/maintenance";
import type { AgentContext } from "../../../lib/ai/agent-context";
import type { TenantScope } from "../../../lib/tenant-context";

interface Row {
  [key: string]: unknown;
}

type Predicate = (row: Row) => boolean;

// A richer in-memory fake than contracts-tool-isolation.test.ts's — Wave 3
// tools chain eq/is/gte/lte/in/lt/gt before either a terminal
// maybeSingle() or being awaited directly as a thenable (the same two
// termination shapes supabase-js's real query builder supports).
class FakeQuery implements PromiseLike<{ data: Row[]; error: null }> {
  private filters: Predicate[] = [];
  private limitN: number | null = null;
  constructor(private rows: Row[]) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (r[col] ?? null) === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  gte(col: string, val: string) {
    this.filters.push((r) => (r[col] as string) >= val);
    return this;
  }
  lte(col: string, val: string) {
    this.filters.push((r) => (r[col] as string) <= val);
    return this;
  }
  lt(col: string, val: string) {
    this.filters.push((r) => (r[col] as string) < val);
    return this;
  }
  gt(col: string, val: string) {
    this.filters.push((r) => (r[col] as string) > val);
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  private matched(): Row[] {
    let found = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.limitN !== null) found = found.slice(0, this.limitN);
    return found;
  }
  async maybeSingle() {
    return { data: this.matched()[0] ?? null, error: null };
  }
  then<TResult1, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(
      onfulfilled ? onfulfilled({ data: this.matched(), error: null }) : (undefined as never),
    );
  }
}

function makeDb(tables: Record<string, Row[]>): SupabaseClient {
  return {
    from: (table: string) => new FakeQuery(tables[table] ?? []),
  } as unknown as SupabaseClient;
}

function makeScope(tenantId: string, db: SupabaseClient): TenantScope {
  return {
    tenantId,
    userId: "user-" + tenantId,
    tenantRole: "operator",
    isImpersonating: false,
    accessMode: "full",
    db,
  };
}

function makeCtx(tenantId: string, permissions: string[]): AgentContext {
  return {
    tenantId,
    userId: "user-" + tenantId,
    tenantRole: "operator",
    permissions,
    entitlements: { active: true, features: [], planKey: null },
    persona: "operator",
    authenticationLevel: "AAL1",
    currentModule: null,
    currentResource: null,
    aiBudget: { balance: 100, currency: "credits" },
    workspaceId: tenantId,
  };
}

describe("Wave 3 tools — cross-tenant isolation", () => {
  it("get_asset returns not-found for an asset belonging to a DIFFERENT tenant", async () => {
    const db = makeDb({ assets: [{ id: "asset-A", tenant_id: "tenant-A", name: "Corolla" }] });
    const result = await getAssetTool.execute(
      { assetId: "asset-A" },
      makeCtx("tenant-B", ["tenant.assets.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("get_asset succeeds for an asset that really belongs to this tenant", async () => {
    const db = makeDb({ assets: [{ id: "asset-B", tenant_id: "tenant-B", name: "Corolla" }] });
    const result = await getAssetTool.execute(
      { assetId: "asset-B" },
      makeCtx("tenant-B", ["tenant.assets.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(true);
  });

  it("get_asset_availability returns not-found (never calls the conflict check) for another tenant's asset", async () => {
    const db = makeDb({
      assets: [{ id: "asset-A", tenant_id: "tenant-A" }],
      operations: [],
    });
    const result = await getAssetAvailabilityTool.execute(
      { assetId: "asset-A", startsAt: "2026-01-01", endsAt: "2026-01-02" },
      makeCtx("tenant-B", ["tenant.assets.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("get_contract returns not-found for a contract belonging to a DIFFERENT tenant", async () => {
    const db = makeDb({ contracts: [{ id: "contract-A", tenant_id: "tenant-A" }] });
    const result = await getContractTool.execute(
      { contractId: "contract-A" },
      makeCtx("tenant-B", ["tenant.contracts.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("get_customer_contracts never returns another tenant's contracts, even for a real organizationId", async () => {
    const db = makeDb({
      contracts: [
        { id: "contract-A", tenant_id: "tenant-A", organization_id: "org-shared" },
        { id: "contract-B", tenant_id: "tenant-B", organization_id: "org-shared" },
      ],
    });
    const result = await getCustomerContractsTool.execute(
      { organizationId: "org-shared" },
      makeCtx("tenant-B", ["tenant.contracts.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(true);
    const rows = result.data as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(["contract-B"]);
  });

  it("get_maintenance_order returns not-found for an order belonging to a DIFFERENT tenant", async () => {
    const db = makeDb({
      maintenance_orders: [{ id: "order-A", tenant_id: "tenant-A" }],
    });
    const result = await getMaintenanceOrderTool.execute(
      { orderId: "order-A" },
      makeCtx("tenant-B", ["tenant.maintenance.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });
});
