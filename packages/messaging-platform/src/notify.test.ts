import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyContactViaWhatsApp } from "./notify.js";
import { FakeMessagingProvider } from "./providers/fake.js";

// ── minimal FakeDb (only what notify.ts + its dependencies touch) ───────
interface Row {
  [k: string]: unknown;
}
class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private filters: Array<(r: Row) => boolean> = [];
  private inserted: { data: Row | null; error: null } | null = null;
  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}
  select() {
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    const created = { id: `${this.table}-${rows.length + 1}`, ...row };
    rows.push(created);
    this.inserted = { data: created, error: null };
    return this;
  }
  update(row: Row) {
    this.op = "update";
    this.payload = row;
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  ilike(c: string, pattern: string) {
    const needle = pattern.replace(/%/g, "");
    this.filters.push((r) => String(r[c] ?? "").includes(needle));
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  private rows() {
    return (this.db.tables[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
  }
  maybeSingle() {
    if (this.op === "insert") return Promise.resolve(this.inserted!);
    if (this.op === "update") {
      const rows = this.rows();
      for (const r of rows) Object.assign(r, this.payload);
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    }
    return Promise.resolve({ data: this.rows()[0] ?? null, error: null });
  }
  single() {
    return this.maybeSingle();
  }
  then(resolve: (v: unknown) => void) {
    resolve({ data: this.rows(), error: null });
  }
}
class FakeDb {
  tables: Record<string, Row[]> = {};
  from(t: string) {
    return new FakeQuery(this, t);
  }
}
const asClient = (db: FakeDb) => db as unknown as SupabaseClient;

function seed(): FakeDb {
  const db = new FakeDb();
  db.tables.messaging_channels = [
    {
      id: "chan-1",
      tenant_id: "t1",
      provider: "whatsapp",
      external_business_account_id: "waba",
      external_phone_number_id: "phone-1",
      external_account_id: null,
      display_phone_number: null,
      display_name: null,
      status: "connected",
      connection_mode: "cloud_api",
      branch_id: null,
      purpose: null,
      created_at: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      disconnected_at: null,
    },
  ];
  db.tables.rental_customers = [{ id: "rc1", phone: "5511988887777" }];
  db.tables.operators = [{ id: "op1", phone: "5511977776666" }];
  db.tables.rental_customer_organizations = [];
  return db;
}

describe("WAVE 3 — notifyContactViaWhatsApp", () => {
  it("sends to a real customer with a phone on file, through the policy gate", async () => {
    const db = seed();
    const result = await notifyContactViaWhatsApp(asClient(db), new FakeMessagingProvider(), {
      tenantId: "t1",
      recipientExternalRef: "customer:rc1",
      subject: "Seu contrato está pronto",
      body: "Acesse o link para visualizar e assinar.",
      ctaUrl: "shinacustomer://contracts/abc",
      entitlementActive: true,
    });
    expect(result.sent).toBe(true);
    expect(db.tables.conversations).toHaveLength(1);
    expect(db.tables.messages[0].body).toContain("shinacustomer://contracts/abc");
  });

  it("sends to an operator (e.g. infraction driver identification)", async () => {
    const db = seed();
    const result = await notifyContactViaWhatsApp(asClient(db), new FakeMessagingProvider(), {
      tenantId: "t1",
      recipientExternalRef: "operator:op1",
      subject: "Indicação de condutor registrada",
      body: "Você foi indicado como condutor em uma infração.",
      entitlementActive: true,
    });
    expect(result.sent).toBe(true);
  });

  it("never sends for a tenant-wide broadcast recipient", async () => {
    const db = seed();
    const result = await notifyContactViaWhatsApp(asClient(db), new FakeMessagingProvider(), {
      tenantId: "t1",
      recipientExternalRef: "tenant:t1",
      subject: "x",
      body: "y",
      entitlementActive: true,
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/single identifiable/);
  });

  it("skips silently (not sent) when the recipient has no phone on file", async () => {
    const db = seed();
    db.tables.rental_customers = [{ id: "rc1", phone: null }];
    const result = await notifyContactViaWhatsApp(asClient(db), new FakeMessagingProvider(), {
      tenantId: "t1",
      recipientExternalRef: "customer:rc1",
      subject: "x",
      body: "y",
      entitlementActive: true,
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/no phone/);
  });

  it("skips when the tenant has no connected channel", async () => {
    const db = seed();
    db.tables.messaging_channels = [];
    const result = await notifyContactViaWhatsApp(asClient(db), new FakeMessagingProvider(), {
      tenantId: "t1",
      recipientExternalRef: "customer:rc1",
      subject: "x",
      body: "y",
      entitlementActive: true,
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/no connected/);
  });

  it("defaults entitlementActive to false — never silently bypasses the plan gate", async () => {
    const db = seed();
    const result = await notifyContactViaWhatsApp(asClient(db), new FakeMessagingProvider(), {
      tenantId: "t1",
      recipientExternalRef: "customer:rc1",
      subject: "x",
      body: "y",
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/entitlement/);
  });

  it("never reaches a different tenant's channel for the same recipient kind", async () => {
    const db = seed();
    db.tables.messaging_channels[0].tenant_id = "tenant-b";
    const result = await notifyContactViaWhatsApp(asClient(db), new FakeMessagingProvider(), {
      tenantId: "t1",
      recipientExternalRef: "customer:rc1",
      subject: "x",
      body: "y",
      entitlementActive: true,
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/no connected/);
  });
});
