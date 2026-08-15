import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAssetsVisibility } from "../../lib/mobile-assets-scope";
import type { MobileContext } from "../../lib/mobile-context";

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private filters: Array<{ col: string; val: unknown; op: "eq" | "in" | "not_null" }> = [];

  constructor(
    private readonly tables: Record<string, Row[]>,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, val, op: "eq" });
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push({ col, val: vals, op: "in" });
    return this;
  }
  not(col: string, _op: string, _val: null) {
    this.filters.push({ col, val: null, op: "not_null" });
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.op === "eq") return row[f.col] === f.val;
      if (f.op === "in") return (f.val as unknown[]).includes(row[f.col]);
      return row[f.col] !== null && row[f.col] !== undefined;
    });
  }

  then(resolve: (v: unknown) => void) {
    const rows = this.tables[this.table] ?? [];
    resolve({ data: rows.filter((r) => this.matches(r)), error: null });
  }
}

function makeDb(tables: Record<string, Row[]>): SupabaseClient {
  return { from: (table: string) => new FakeQuery(tables, table) } as unknown as SupabaseClient;
}

describe("resolveAssetsVisibility", () => {
  it("tenant_user gets a tenant-wide visibility descriptor, no query performed", async () => {
    const context: MobileContext = {
      userType: "tenant_user",
      userId: "u1",
      email: null,
      tenantId: "tenant-1",
      tenantRole: "tenant_owner",
      isImpersonating: false,
      accessMode: "full",
      db: makeDb({}),
    };
    const result = await resolveAssetsVisibility(context);
    expect(result).toEqual({ kind: "tenant", tenantId: "tenant-1" });
  });

  it("operator resolves visible asset ids from operator_assignments.asset_id only, cross-operator isolated", async () => {
    const db = makeDb({
      operator_assignments: [
        { operator_id: "op-1", asset_id: "asset-a" },
        { operator_id: "op-1", asset_id: "asset-b" },
        { operator_id: "op-OTHER", asset_id: "asset-not-mine" },
      ],
    });
    const context: MobileContext = {
      userType: "operator",
      userId: "u2",
      email: null,
      operatorId: "op-1",
      tenantId: "tenant-1",
      db,
    };
    const result = await resolveAssetsVisibility(context);
    expect(result?.kind).toBe("ids");
    if (result?.kind === "ids") {
      expect(result.assetIds.sort()).toEqual(["asset-a", "asset-b"]);
      expect(result.assetIds).not.toContain("asset-not-mine");
    }
  });

  it("customer resolves visible asset ids via contracts -> contract_assets, cross-customer isolated", async () => {
    const db = makeDb({
      contracts: [
        { id: "contract-1", organization_id: "org-mine" },
        { id: "contract-OTHER", organization_id: "org-not-mine" },
      ],
      contract_assets: [
        { contract_id: "contract-1", asset_id: "asset-mine" },
        { contract_id: "contract-OTHER", asset_id: "asset-not-mine" },
      ],
    });
    const context: MobileContext = {
      userType: "customer",
      userId: "u3",
      email: null,
      customerId: "cust-1",
      organizations: [{ organizationId: "org-mine", tenantId: "tenant-1" }],
      db,
    };
    const result = await resolveAssetsVisibility(context);
    expect(result?.kind).toBe("ids");
    if (result?.kind === "ids") {
      expect(result.assetIds).toEqual(["asset-mine"]);
      expect(result.assetIds).not.toContain("asset-not-mine");
    }
  });

  it("customer with zero organizations gets an empty asset list without querying", async () => {
    const context: MobileContext = {
      userType: "customer",
      userId: "u4",
      email: null,
      customerId: "cust-2",
      organizations: [],
      db: makeDb({}),
    };
    const result = await resolveAssetsVisibility(context);
    expect(result).toEqual({ kind: "ids", assetIds: [] });
  });

  it("unprovisioned resolves to null — no assets visible at all", async () => {
    const context: MobileContext = { userType: "unprovisioned", userId: "u5", email: null };
    const result = await resolveAssetsVisibility(context);
    expect(result).toBeNull();
  });
});
