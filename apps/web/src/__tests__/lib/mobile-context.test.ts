import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// getActiveImpersonation reads Next.js cookies() — not available outside a
// request context, so it's mocked here. Every other branch of
// resolveMobileContext() is exercised against a real (fake) db client and
// real claim shapes, no mocking needed there.
const mockGetActiveImpersonation = vi.fn();
vi.mock("@/lib/impersonation", () => ({
  getActiveImpersonation: (...args: unknown[]) => mockGetActiveImpersonation(...args),
}));

const { resolveMobileContext } = await import("../../lib/mobile-context");

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

  private matches(row: Row): boolean {
    return this.filters.every((f) =>
      f.op === "eq" ? row[f.col] === f.val : (f.val as unknown[]).includes(row[f.col]),
    );
  }

  maybeSingle() {
    const rows = this.tables[this.table] ?? [];
    const matched = rows.filter((r) => this.matches(r));
    return Promise.resolve({ data: matched[0] ?? null, error: null });
  }

  then(resolve: (v: unknown) => void) {
    const rows = this.tables[this.table] ?? [];
    resolve({ data: rows.filter((r) => this.matches(r)), error: null });
  }
}

function makeDb(tables: Record<string, Row[]>): SupabaseClient {
  return {
    from: (table: string) => new FakeQuery(tables, table),
  } as unknown as SupabaseClient;
}

describe("resolveMobileContext", () => {
  beforeEach(() => {
    mockGetActiveImpersonation.mockReset();
  });

  it("resolves tenant_user directly from claims.tenant_id — never queries any table", async () => {
    const db = makeDb({}); // no tables seeded; if this branch queried anything, it would find nothing and misbehave
    const ctx = await resolveMobileContext({
      claims: { tenant_id: "tenant-1", tenant_role: "tenant_admin" },
      userId: "user-1",
      email: "a@b.com",
      db,
    });
    expect(ctx).toMatchObject({
      userType: "tenant_user",
      tenantId: "tenant-1",
      tenantRole: "tenant_admin",
    });
  });

  it("a forged tenant_id in claims is used as-is (it's already been verified by the JWT signature check upstream) — proving the function has no OTHER input that could override it", async () => {
    // This test documents the trust boundary: resolveMobileContext's only
    // tenant_id source is `claims.tenant_id`. There is no second parameter
    // (body, header, query) it could read instead — so "forging" tenant_id
    // is only possible by forging the JWT itself, which is out of scope for
    // this function (verified upstream by supabase.auth.getSession()).
    const db = makeDb({});
    const ctx = await resolveMobileContext({
      claims: { tenant_id: "attacker-claimed-tenant" },
      userId: "user-1",
      email: null,
      db,
    });
    expect(ctx.userType).toBe("tenant_user");
    if (ctx.userType === "tenant_user") {
      expect(ctx.tenantId).toBe("attacker-claimed-tenant");
    }
  });

  it("platform_role with active impersonation resolves as tenant_user for the impersonated tenant", async () => {
    mockGetActiveImpersonation.mockResolvedValue({
      tenantId: "tenant-impersonated",
      accessMode: "read_only",
    });
    const db = makeDb({});
    const ctx = await resolveMobileContext({
      claims: { platform_role: "support" },
      userId: "platform-user-1",
      email: null,
      db,
    });
    expect(ctx).toMatchObject({
      userType: "tenant_user",
      tenantId: "tenant-impersonated",
      isImpersonating: true,
      accessMode: "read_only",
    });
  });

  it("platform_role without active impersonation falls through to unprovisioned (not a supported mobile identity)", async () => {
    mockGetActiveImpersonation.mockResolvedValue(null);
    const db = makeDb({});
    const ctx = await resolveMobileContext({
      claims: { platform_role: "support" },
      userId: "platform-user-1",
      email: "p@shinaia.com.br",
      db,
    });
    expect(ctx.userType).toBe("unprovisioned");
  });

  it("resolves customer with organization membership", async () => {
    const db = makeDb({
      rental_customers: [{ id: "cust-1", auth_user_id: "user-2" }],
      rental_customer_organizations: [
        { rental_customer_id: "cust-1", organization_id: "org-1", tenant_id: "tenant-a" },
      ],
    });
    const ctx = await resolveMobileContext({
      claims: {},
      userId: "user-2",
      email: "c@b.com",
      db,
    });
    expect(ctx).toMatchObject({
      userType: "customer",
      customerId: "cust-1",
      organizations: [{ organizationId: "org-1", tenantId: "tenant-a" }],
    });
  });

  it("customer identity with ZERO organization links is unprovisioned, not an empty-list customer", async () => {
    const db = makeDb({
      rental_customers: [{ id: "cust-2", auth_user_id: "user-3" }],
      rental_customer_organizations: [],
    });
    const ctx = await resolveMobileContext({
      claims: {},
      userId: "user-3",
      email: null,
      db,
    });
    expect(ctx.userType).toBe("unprovisioned");
  });

  it("resolves an active operator", async () => {
    const db = makeDb({
      operators: [{ id: "op-1", auth_user_id: "user-4", tenant_id: "tenant-b", status: "active" }],
    });
    const ctx = await resolveMobileContext({
      claims: {},
      userId: "user-4",
      email: null,
      db,
    });
    expect(ctx).toMatchObject({ userType: "operator", operatorId: "op-1", tenantId: "tenant-b" });
  });

  it("an inactive operator (status != active) is unprovisioned — deactivation actually revokes access", async () => {
    const db = makeDb({
      operators: [
        { id: "op-2", auth_user_id: "user-5", tenant_id: "tenant-b", status: "inactive" },
      ],
    });
    const ctx = await resolveMobileContext({
      claims: {},
      userId: "user-5",
      email: null,
      db,
    });
    expect(ctx.userType).toBe("unprovisioned");
  });

  it("an authenticated user with no membership anywhere is unprovisioned — the self-signup guardrail's actual enforcement point", async () => {
    const db = makeDb({ rental_customers: [], operators: [] });
    const ctx = await resolveMobileContext({
      claims: {},
      userId: "brand-new-google-user",
      email: "new@gmail.com",
      db,
    });
    expect(ctx).toEqual({
      userType: "unprovisioned",
      userId: "brand-new-google-user",
      email: "new@gmail.com",
    });
  });

  it("cross-tenant: a customer's organizations never include a tenant they aren't actually linked to", async () => {
    const db = makeDb({
      rental_customers: [{ id: "cust-3", auth_user_id: "user-6" }],
      rental_customer_organizations: [
        { rental_customer_id: "cust-3", organization_id: "org-x", tenant_id: "tenant-x" },
      ],
    });
    const ctx = await resolveMobileContext({ claims: {}, userId: "user-6", email: null, db });
    expect(ctx.userType).toBe("customer");
    if (ctx.userType === "customer") {
      expect(ctx.organizations.map((o) => o.tenantId)).toEqual(["tenant-x"]);
      expect(ctx.organizations.map((o) => o.tenantId)).not.toContain("tenant-y-never-linked");
    }
  });
});
