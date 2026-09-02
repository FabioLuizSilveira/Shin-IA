import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { mapStripeStatus, syncStripeEvent } from "./sync-webhook.js";
import { hasLiveSubscription } from "./session-claims.js";

// ── Minimal in-memory Supabase fake ────────────────────────────────────────────
// Implements only the chains syncStripeEvent uses, with real unique-index
// behavior for gateway_event_id so the idempotency path is actually exercised.

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private op: "select" | "insert" | "upsert" | "update" = "select";
  private row: Row = {};
  private filters: Array<{ kind: "eq" | "neq"; col: string; val: unknown }> = [];
  private wantSingle = false;
  private wantMaybe = false;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  insert(row: Row) {
    this.op = "insert";
    this.row = row;
    return this;
  }
  upsert(row: Row, _opts?: unknown) {
    this.op = "upsert";
    this.row = row;
    return this;
  }
  update(row: Row) {
    this.op = "update";
    this.row = row;
    return this;
  }
  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push({ kind: "neq", col, val });
    return this;
  }
  single() {
    this.wantSingle = true;
    return this;
  }
  maybeSingle() {
    this.wantMaybe = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) =>
      f.kind === "eq" ? row[f.col] === f.val : row[f.col] !== f.val,
    );
  }

  private execute(): {
    data: Row | Row[] | null;
    error: { code?: string; message: string } | null;
  } {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);

    if (this.op === "insert") {
      if (
        this.table === "platform_billing_events" &&
        this.row.gateway_event_id &&
        rows.some((r) => r.gateway_event_id === this.row.gateway_event_id)
      ) {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      const inserted = { id: `id-${this.db.nextId++}`, ...this.row };
      rows.push(inserted);
      return { data: inserted, error: null };
    }

    if (this.op === "upsert") {
      const existing = rows.find((r) => r.auth_user_id === this.row.auth_user_id);
      if (existing) {
        Object.assign(existing, this.row);
        return { data: existing, error: null };
      }
      const inserted = { id: `id-${this.db.nextId++}`, ...this.row };
      rows.push(inserted);
      return { data: inserted, error: null };
    }

    if (this.op === "update") {
      const matched = rows.filter((r) => this.matches(r));
      matched.forEach((r) => Object.assign(r, this.row));
      return { data: matched[0] ?? null, error: null };
    }

    const matched = rows.filter((r) => this.matches(r));
    return { data: matched[0] ?? null, error: null };
  }

  then<T>(resolve: (value: { data: never; error: never }) => T): T {
    const result = this.execute();
    if ((this.wantSingle || this.wantMaybe) && Array.isArray(result.data)) {
      result.data = result.data[0] ?? null;
    }
    return resolve(result as never);
  }
}

class FakeDb {
  tables: Record<string, Row[]> = {};
  nextId = 1;
  from(table: string) {
    return new FakeQuery(this, table);
  }
}

function checkoutEvent(id: string, overrides?: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        client_reference_id: "auth-user-1",
        customer_details: { email: "buyer@example.com" },
        customer: "cus_123",
        subscription: "sub_123",
        metadata: { product: "mkt", plan: "pro" },
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

describe("syncStripeEvent", () => {
  it("provisions customer + subscription on checkout.session.completed", async () => {
    const db = new FakeDb();
    const result = await syncStripeEvent(db as unknown as SupabaseClient, checkoutEvent("evt_1"));

    expect(result.duplicate).toBe(false);
    expect(result.handled).toBe(true);

    const customers = db.tables["platform_customers"];
    expect(customers).toHaveLength(1);
    expect(customers[0].auth_user_id).toBe("auth-user-1");
    expect(customers[0].gateway_customer_id).toBe("cus_123");

    const subs = db.tables["platform_subscriptions"];
    expect(subs).toHaveLength(1);
    expect(subs[0].product).toBe("mkt");
    expect(subs[0].plan_key).toBe("pro");
    expect(subs[0].status).toBe("active");
    expect(subs[0].gateway_subscription_id).toBe("sub_123");
  });

  it("is idempotent — a replayed event id changes nothing", async () => {
    const db = new FakeDb();
    await syncStripeEvent(db as unknown as SupabaseClient, checkoutEvent("evt_dup"));
    const replay = await syncStripeEvent(db as unknown as SupabaseClient, checkoutEvent("evt_dup"));

    expect(replay.duplicate).toBe(true);
    expect(db.tables["platform_subscriptions"]).toHaveLength(1);
    expect(db.tables["platform_billing_events"]).toHaveLength(1);
  });

  it("reuses the live subscription instead of duplicating it", async () => {
    const db = new FakeDb();
    await syncStripeEvent(db as unknown as SupabaseClient, checkoutEvent("evt_a"));
    await syncStripeEvent(
      db as unknown as SupabaseClient,
      checkoutEvent("evt_b", { metadata: { product: "mkt", plan: "business" } }),
    );

    const subs = db.tables["platform_subscriptions"];
    expect(subs).toHaveLength(1);
    expect(subs[0].plan_key).toBe("business");
  });

  it("skips sessions without client_reference_id (pre-identity checkout)", async () => {
    const db = new FakeDb();
    const result = await syncStripeEvent(
      db as unknown as SupabaseClient,
      checkoutEvent("evt_noref", { client_reference_id: null }),
    );
    expect(result.handled).toBe(false);
    expect(db.tables["platform_subscriptions"]).toBeUndefined();
  });

  it("cancels by gateway_subscription_id on customer.subscription.deleted", async () => {
    const db = new FakeDb();
    await syncStripeEvent(db as unknown as SupabaseClient, checkoutEvent("evt_c"));

    const cancelEvent = {
      id: "evt_cancel",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123", status: "canceled" } },
    } as unknown as Stripe.Event;
    const result = await syncStripeEvent(db as unknown as SupabaseClient, cancelEvent);

    expect(result.handled).toBe(true);
    expect(db.tables["platform_subscriptions"][0].status).toBe("cancelled");
    expect(db.tables["platform_subscriptions"][0].cancelled_at).toBeTruthy();
  });
});

describe("mapStripeStatus", () => {
  it("maps stripe vocabulary to the normalized statuses", () => {
    expect(mapStripeStatus("trialing")).toBe("trialing");
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("unpaid")).toBe("suspended");
    expect(mapStripeStatus("canceled")).toBe("cancelled");
    expect(mapStripeStatus("incomplete")).toBe("pending");
    expect(mapStripeStatus("something_new")).toBe("pending");
  });
});

describe("hasLiveSubscription", () => {
  it("grants only trialing and active", () => {
    expect(hasLiveSubscription("trialing")).toBe(true);
    expect(hasLiveSubscription("active")).toBe(true);
    expect(hasLiveSubscription("past_due")).toBe(false);
    expect(hasLiveSubscription("suspended")).toBe(false);
    expect(hasLiveSubscription("cancelled")).toBe(false);
    expect(hasLiveSubscription(null)).toBe(false);
    expect(hasLiveSubscription(undefined)).toBe(false);
  });
});
