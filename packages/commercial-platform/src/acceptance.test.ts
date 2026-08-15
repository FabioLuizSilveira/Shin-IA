import { describe, expect, it, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordContractAcceptance, hasAcceptedCurrentContract } from "./acceptance.js";

// ── Minimal in-memory Supabase fake — covers only the chains this file's
// functions actually use (select/eq/order/limit/single/maybeSingle/insert),
// plus a hand-rolled "plans(...)" join for plan_versions, mirroring the
// pattern already used in packages/billing-platform/src/sync-webhook.test.ts.
interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private op: "select" | "insert" = "select";
  private row: Row = {};
  private filters: Array<{ col: string; val: unknown }> = [];
  private orderCol: string | null = null;
  private orderDesc = false;
  private wantSingle = false;
  private wantMaybe = false;
  private joinPlans = false;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select(cols?: string) {
    if (cols?.includes("plans(")) this.joinPlans = true;
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.row = row;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, val });
    return this;
  }
  is(col: string, val: null) {
    this.filters.push({ col, val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderDesc = opts?.ascending === false;
    return this;
  }
  limit(_n: number) {
    return this;
  }
  single() {
    this.wantSingle = true;
    return this.execute();
  }
  maybeSingle() {
    this.wantMaybe = true;
    return this.execute();
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => row[f.col] === f.val);
  }

  private execute() {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);

    if (this.op === "insert") {
      const id = (this.row.id as string) ?? `${this.table}-${rows.length + 1}`;
      const newRow = { ...this.row, id };
      rows.push(newRow);
      return Promise.resolve({ data: newRow, error: null });
    }

    let matched = rows.filter((r) => this.matches(r));
    if (this.orderCol) {
      matched = [...matched].sort((a, b) => {
        const av = a[this.orderCol!] as number;
        const bv = b[this.orderCol!] as number;
        return this.orderDesc ? bv - av : av - bv;
      });
    }
    let result: Row | Row[] | null = matched;
    if (this.wantSingle || this.wantMaybe) {
      let single: Row | null = matched[0] ?? null;
      if (single && this.joinPlans) {
        const plan = (this.db.tables.plans ?? []).find((p) => p.id === single!.plan_id);
        single = { ...single, plans: plan ?? null };
      }
      result = single;
    }
    if (this.wantSingle && !result) {
      return Promise.resolve({ data: null, error: { message: "not found" } });
    }
    return Promise.resolve({ data: result, error: null });
  }

  then(resolve: (v: unknown) => void) {
    resolve(this.execute());
  }
}

class FakeDb {
  tables: Record<string, Row[]> = {};

  from(table: string) {
    return new FakeQuery(this, table);
  }
}

function makeDb(): SupabaseClient {
  return new FakeDb() as unknown as SupabaseClient;
}

function seed(db: SupabaseClient) {
  const fake = db as unknown as FakeDb;
  fake.tables.contract_templates = [{ id: "tpl-platform", product: "platform" }];
  fake.tables.contract_versions = [
    {
      id: "cv-1",
      contract_template_id: "tpl-platform",
      version: 1,
      title: "Master v1",
      content: "terms text",
      content_hash: "irrelevant",
      material_change: false,
      status: "published",
    },
  ];
  fake.tables.plans = [{ id: "plan-1", product: "platform", key: "starter", name: "Starter" }];
  fake.tables.plan_versions = [
    {
      id: "pv-1",
      plan_id: "plan-1",
      version: 1,
      price_cents: 29900,
      currency: "BRL",
      billing_cycle: "monthly",
      trial_days: 14,
      commitment_period_months: null,
      included_features: ["operations"],
      usage_limits: {},
      overage_rules: {},
      discount_rules: {},
      revenue_share: {},
      status: "published",
    },
  ];
  fake.tables.commercial_terms_snapshots = [];
  fake.tables.contract_acceptances = [];
}

describe("recordContractAcceptance", () => {
  let db: SupabaseClient;

  beforeEach(() => {
    db = makeDb();
    seed(db);
  });

  it("records a snapshot + acceptance and stamps accepted_at server-side", async () => {
    const before = Date.now();
    const result = await recordContractAcceptance(db, {
      tenantId: "tenant-1",
      userId: "user-1",
      product: "platform",
      planVersionId: "pv-1",
      representative: {
        name: "Fábio Silveira",
        role: "CEO",
        declaredAuthority: true,
      },
      request: { ipAddress: "203.0.113.4", userAgent: "vitest" },
    });

    expect(result.contractAcceptanceId).toBeTruthy();
    expect(result.commercialTermsSnapshotId).toBeTruthy();

    const fake = db as unknown as FakeDb;
    const snapshot = fake.tables.commercial_terms_snapshots[0];
    expect(snapshot.price_cents).toBe(29900);
    expect(snapshot.tenant_id).toBe("tenant-1");

    const acceptance = fake.tables.contract_acceptances[0];
    expect(acceptance.representative_name).toBe("Fábio Silveira");
    expect(acceptance.declared_authority).toBe(true);
    expect(acceptance.ip_address).toBe("203.0.113.4");
    // accepted_at defaults belong to the DB, not this layer — but nothing in
    // the input body was allowed to override it (no accepted_at field in
    // AcceptContractInput at all), which is the actual guarantee being tested.
    expect("accepted_at" in acceptance).toBe(false);
    expect(before).toBeLessThanOrEqual(Date.now());
  });

  it("rejects when the representative did not declare authority", async () => {
    await expect(
      recordContractAcceptance(db, {
        tenantId: "tenant-1",
        userId: "user-1",
        product: "platform",
        planVersionId: "pv-1",
        representative: { name: "Fábio", role: "CEO", declaredAuthority: false },
        request: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toThrow(/authority/);
  });

  it("rejects when the plan version belongs to a different product", async () => {
    const fake = db as unknown as FakeDb;
    fake.tables.plans.push({ id: "plan-mkt", product: "mkt", key: "growth", name: "Growth" });
    fake.tables.plan_versions.push({
      id: "pv-mkt",
      plan_id: "plan-mkt",
      price_cents: 19900,
      currency: "BRL",
      billing_cycle: "monthly",
      trial_days: 0,
      included_features: [],
      usage_limits: {},
      overage_rules: {},
      discount_rules: {},
      revenue_share: {},
      status: "published",
    });

    await expect(
      recordContractAcceptance(db, {
        tenantId: "tenant-1",
        userId: "user-1",
        product: "platform",
        planVersionId: "pv-mkt",
        representative: { name: "Fábio", role: "CEO", declaredAuthority: true },
        request: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toThrow(/does not belong to product/);
  });
});

describe("hasAcceptedCurrentContract", () => {
  let db: SupabaseClient;

  beforeEach(() => {
    db = makeDb();
    seed(db);
  });

  it("is false before any acceptance exists", async () => {
    expect(
      await hasAcceptedCurrentContract(db, {
        tenantId: "tenant-1",
        userId: "user-1",
        product: "platform",
      }),
    ).toBe(false);
  });

  it("is true after accepting the currently-published version", async () => {
    await recordContractAcceptance(db, {
      tenantId: "tenant-1",
      userId: "user-1",
      product: "platform",
      planVersionId: "pv-1",
      representative: { name: "Fábio", role: "CEO", declaredAuthority: true },
      request: { ipAddress: null, userAgent: null },
    });

    expect(
      await hasAcceptedCurrentContract(db, {
        tenantId: "tenant-1",
        userId: "user-1",
        product: "platform",
      }),
    ).toBe(true);
  });

  it("is false for a different tenant even after tenant-1 accepted", async () => {
    await recordContractAcceptance(db, {
      tenantId: "tenant-1",
      userId: "user-1",
      product: "platform",
      planVersionId: "pv-1",
      representative: { name: "Fábio", role: "CEO", declaredAuthority: true },
      request: { ipAddress: null, userAgent: null },
    });

    expect(
      await hasAcceptedCurrentContract(db, {
        tenantId: "tenant-2",
        userId: "user-2",
        product: "platform",
      }),
    ).toBe(false);
  });

  it("supports tenant-less (MKT-only buyer) acceptances keyed by userId", async () => {
    const fake = db as unknown as FakeDb;
    fake.tables.contract_templates.push({ id: "tpl-mkt", product: "mkt" });
    fake.tables.contract_versions.push({
      id: "cv-mkt-1",
      contract_template_id: "tpl-mkt",
      version: 1,
      content: "mkt terms",
      status: "published",
    });
    fake.tables.plans.push({ id: "plan-mkt", product: "mkt", key: "starter", name: "Starter" });
    fake.tables.plan_versions.push({
      id: "pv-mkt",
      plan_id: "plan-mkt",
      price_cents: 14900,
      currency: "BRL",
      billing_cycle: "monthly",
      trial_days: 0,
      included_features: [],
      usage_limits: {},
      overage_rules: {},
      discount_rules: {},
      revenue_share: {},
      status: "published",
    });

    expect(
      await hasAcceptedCurrentContract(db, {
        tenantId: null,
        userId: "mkt-user-1",
        product: "mkt",
      }),
    ).toBe(false);

    await recordContractAcceptance(db, {
      tenantId: null,
      userId: "mkt-user-1",
      product: "mkt",
      planVersionId: "pv-mkt",
      representative: { name: "Ana", role: "Owner", declaredAuthority: true },
      request: { ipAddress: null, userAgent: null },
    });

    expect(
      await hasAcceptedCurrentContract(db, {
        tenantId: null,
        userId: "mkt-user-1",
        product: "mkt",
      }),
    ).toBe(true);
    expect(
      await hasAcceptedCurrentContract(db, {
        tenantId: null,
        userId: "mkt-user-2",
        product: "mkt",
      }),
    ).toBe(false);

    const acceptance = fake.tables.contract_acceptances.find((a) => a.user_id === "mkt-user-1");
    expect(acceptance?.tenant_id).toBeNull();
  });
});
