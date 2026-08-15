import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveActiveBranchScope, assertBranchAccess } from "../../lib/mobile-branch-scope";
import type { TenantScope } from "../../lib/tenant-context";

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private filters: Array<{ col: string; val: unknown; op: "eq" | "in" }> = [];

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
  is(col: string, val: null) {
    this.filters.push({ col, val, op: "eq" });
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) =>
      f.op === "eq" ? row[f.col] === f.val : (f.val as unknown[]).includes(row[f.col]),
    );
  }

  then(resolve: (v: unknown) => void) {
    const rows = this.tables[this.table] ?? [];
    resolve({ data: rows.filter((r) => this.matches(r)), error: null });
  }
}

function makeScope(
  tables: Record<string, Row[]>,
  overrides: Partial<TenantScope> = {},
): TenantScope {
  const db = {
    from: (table: string) => new FakeQuery(tables, table),
  } as unknown as SupabaseClient;
  return {
    tenantId: "tenant-1",
    userId: "user-1",
    tenantRole: "fleet_manager",
    isImpersonating: false,
    accessMode: "full",
    db,
    ...overrides,
  };
}

describe("resolveActiveBranchScope", () => {
  it("root mode grants unrestricted access (allowedBranchIds: null)", async () => {
    const scope = makeScope({
      tenant_user_roles: [
        {
          tenant_id: "tenant-1",
          user_id: "user-1",
          branch_scope_mode: "root",
          branch_id: null,
          deleted_at: null,
        },
      ],
    });
    const result = await resolveActiveBranchScope(scope);
    expect(result).toEqual({ mode: "root", allowedBranchIds: null });
  });

  it("branch mode restricts to exactly the assigned branch, resolved server-side", async () => {
    const scope = makeScope({
      tenant_user_roles: [
        {
          tenant_id: "tenant-1",
          user_id: "user-1",
          branch_scope_mode: "branch",
          branch_id: "branch-a",
          deleted_at: null,
        },
      ],
    });
    const result = await resolveActiveBranchScope(scope);
    expect(result).toEqual({ mode: "branch", allowedBranchIds: ["branch-a"] });
  });

  it("branch_and_children expands to descendant branches via branches.parent_id, never from client input", async () => {
    const scope = makeScope({
      tenant_user_roles: [
        {
          tenant_id: "tenant-1",
          user_id: "user-1",
          branch_scope_mode: "branch_and_children",
          branch_id: "branch-root",
          deleted_at: null,
        },
      ],
      branches: [
        { id: "branch-child-1", parent_id: "branch-root", tenant_id: "tenant-1", deleted_at: null },
        {
          id: "branch-grandchild-1",
          parent_id: "branch-child-1",
          tenant_id: "tenant-1",
          deleted_at: null,
        },
        {
          id: "branch-unrelated",
          parent_id: "some-other-branch",
          tenant_id: "tenant-1",
          deleted_at: null,
        },
      ],
    });
    const result = await resolveActiveBranchScope(scope);
    expect(result.mode).toBe("branch_and_children");
    expect(result.allowedBranchIds).toContain("branch-root");
    expect(result.allowedBranchIds).toContain("branch-child-1");
    expect(result.allowedBranchIds).toContain("branch-grandchild-1");
    expect(result.allowedBranchIds).not.toContain("branch-unrelated");
  });

  it("no role rows resolves to custom/deny-by-default, never to unrestricted", async () => {
    const scope = makeScope({ tenant_user_roles: [] });
    const result = await resolveActiveBranchScope(scope);
    expect(result).toEqual({ mode: "custom", allowedBranchIds: [] });
  });
});

describe("assertBranchAccess", () => {
  it("a forged branchId not in the resolved allow-list is rejected", async () => {
    const scope = makeScope({
      tenant_user_roles: [
        {
          tenant_id: "tenant-1",
          user_id: "user-1",
          branch_scope_mode: "branch",
          branch_id: "branch-real",
          deleted_at: null,
        },
      ],
    });
    expect(await assertBranchAccess(scope, "branch-forged-by-client")).toBe(false);
    expect(await assertBranchAccess(scope, "branch-real")).toBe(true);
  });

  it("root scope accepts any branchId (unrestricted by design)", async () => {
    const scope = makeScope({
      tenant_user_roles: [
        {
          tenant_id: "tenant-1",
          user_id: "user-1",
          branch_scope_mode: "root",
          branch_id: null,
          deleted_at: null,
        },
      ],
    });
    expect(await assertBranchAccess(scope, "any-branch-at-all")).toBe(true);
  });
});
