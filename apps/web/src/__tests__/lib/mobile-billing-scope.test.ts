import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { customerBillingAccountIds } from "../../lib/mobile-billing-scope";
import type { CustomerMobileContext } from "../../lib/mobile-context";

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private filters: Array<{ col: string; val: unknown; op: "eq" | "in" | "is" }> = [];

  constructor(
    private readonly tables: Record<string, Row[]>,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push({ col, val: vals, op: "in" });
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push({ col, val, op: "is" });
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.op === "in") return (f.val as unknown[]).includes(row[f.col]);
      return row[f.col] === f.val;
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

function makeContext(db: SupabaseClient): CustomerMobileContext {
  return {
    userType: "customer",
    userId: "u1",
    email: null,
    customerId: "cust-1",
    organizations: [{ organizationId: "org-mine", tenantId: "tenant-1" }],
    db,
  };
}

describe("customerBillingAccountIds", () => {
  it("resolves billing_accounts scoped to the given organizationIds, cross-org isolated", async () => {
    const db = makeDb({
      billing_accounts: [
        { id: "ba-mine", organization_id: "org-mine", deleted_at: null },
        { id: "ba-not-mine", organization_id: "org-not-mine", deleted_at: null },
      ],
    });
    const ids = await customerBillingAccountIds(makeContext(db), ["org-mine"]);
    expect(ids).toEqual(["ba-mine"]);
    expect(ids).not.toContain("ba-not-mine");
  });

  it("returns an empty list without querying when organizationIds is empty", async () => {
    const db = makeDb({
      billing_accounts: [{ id: "ba-x", organization_id: "org-x", deleted_at: null }],
    });
    const ids = await customerBillingAccountIds(makeContext(db), []);
    expect(ids).toEqual([]);
  });
});
