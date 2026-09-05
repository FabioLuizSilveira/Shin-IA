import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCustomerTool } from "../../../lib/ai/tools/customers";
import { getInfractionsTool } from "../../../lib/ai/tools/infractions";
import { getResourceLocationTool } from "../../../lib/ai/tools/tracking";
import { getInspectionFindingsTool } from "../../../lib/ai/tools/inspections";
import type { AgentContext } from "../../../lib/ai/agent-context";
import type { TenantScope } from "../../../lib/tenant-context";

interface Row {
  [key: string]: unknown;
}

type Predicate = (row: Row) => boolean;

// Same richer fake as wave3-tools-isolation.test.ts (kept file-local, same
// convention as every other agent-tool test in this directory).
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
  is(col: string, val: unknown) {
    this.filters.push((r) => (r[col] ?? null) === val);
    return this;
  }
  ilike(col: string, val: string) {
    const needle = val.replace(/%/g, "").toLowerCase();
    this.filters.push((r) =>
      String(r[col] ?? "")
        .toLowerCase()
        .includes(needle),
    );
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

describe("Wave 4 tools — cross-tenant isolation", () => {
  it("get_customer returns not-found for an organization belonging to a DIFFERENT tenant", async () => {
    const db = makeDb({
      organizations: [{ id: "org-A", tenant_id: "tenant-A", type: "customer" }],
    });
    const result = await getCustomerTool.execute(
      { customerId: "org-A" },
      makeCtx("tenant-B", ["tenant.customers.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("get_infractions never returns another tenant's cases even when scoped by a shared assetId", async () => {
    const db = makeDb({
      infraction_cases: [
        { id: "case-A", tenant_id: "tenant-A", asset_id: "asset-shared" },
        { id: "case-B", tenant_id: "tenant-B", asset_id: "asset-shared" },
      ],
    });
    const result = await getInfractionsTool.execute(
      { assetId: "asset-shared" },
      makeCtx("tenant-B", ["tenant.infractions.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(true);
    const rows = result.data as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(["case-B"]);
  });

  it("get_resource_location returns not-found for a resource with no location row under this tenant", async () => {
    const db = makeDb({
      resource_locations: [
        { resource_id: "res-A", tenant_id: "tenant-A", latitude: 1, longitude: 2 },
      ],
    });
    const result = await getResourceLocationTool.execute(
      { resourceId: "res-A" },
      makeCtx("tenant-B", ["tenant.tracking.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
  });

  it("get_inspection_findings returns not-found for an inspection belonging to a DIFFERENT tenant, even though inspection_findings has no tenant_id of its own", async () => {
    const db = makeDb({
      inspections: [{ id: "insp-A", tenant_id: "tenant-A" }],
      inspection_findings: [{ id: "finding-A", inspection_id: "insp-A", description: "risco" }],
    });
    const result = await getInspectionFindingsTool.execute(
      { inspectionId: "insp-A" },
      makeCtx("tenant-B", ["tenant.inspections.view"]),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });
});
