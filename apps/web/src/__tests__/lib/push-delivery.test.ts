import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverPushForNotification } from "../../lib/push/delivery";
import type { MobilePushProvider, PushMessage, PushDeliveryResult } from "../../lib/push/types";

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private filters: Array<{ col: string; val: unknown; op: "eq" | "in" | "is" | "not_null" }> = [];
  private updatePatch: Record<string, unknown> | null = null;

  constructor(
    private readonly tables: Record<string, Row[]>,
    private readonly table: string,
    private readonly updateCalls: Array<{
      table: string;
      patch: Record<string, unknown>;
      ids: string[];
    }>,
  ) {}

  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, val, op: "eq" });
    return this;
  }
  in(col: string, vals: unknown[]) {
    if (this.updatePatch) {
      this.updateCalls.push({ table: this.table, patch: this.updatePatch, ids: vals as string[] });
      return Promise.resolve({ data: null, error: null });
    }
    this.filters.push({ col, val: vals, op: "in" });
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push({ col, val, op: "is" });
    return this;
  }
  not(col: string, _op: string, _val: null) {
    this.filters.push({ col, val: null, op: "not_null" });
    return this;
  }
  update(patch: Record<string, unknown>) {
    this.updatePatch = patch;
    return this;
  }
  insert(_row: Record<string, unknown>) {
    return Promise.resolve({ data: null, error: null });
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.op === "eq") return row[f.col] === f.val;
      if (f.op === "in") return (f.val as unknown[]).includes(row[f.col]);
      if (f.op === "is") return row[f.col] === f.val;
      return row[f.col] !== null && row[f.col] !== undefined;
    });
  }

  maybeSingle() {
    const rows = this.tables[this.table] ?? [];
    const match = rows.find((r) => this.matches(r)) ?? null;
    return Promise.resolve({ data: match, error: null });
  }

  then(resolve: (v: unknown) => void) {
    const rows = this.tables[this.table] ?? [];
    resolve({ data: rows.filter((r) => this.matches(r)), error: null });
  }
}

function makeDb(tables: Record<string, Row[]>) {
  const updateCalls: Array<{ table: string; patch: Record<string, unknown>; ids: string[] }> = [];
  const db = {
    from: (table: string) => new FakeQuery(tables, table, updateCalls),
  } as unknown as SupabaseClient;
  return { db, updateCalls };
}

describe("deliverPushForNotification", () => {
  it("resolves a customer recipient's own device only, sends via the provider", async () => {
    const { db } = makeDb({
      rental_customers: [{ id: "cust-1", auth_user_id: "user-1" }],
      mobile_devices: [
        { id: "dev-1", user_id: "user-1", push_token: "tok-1", enabled: true },
        { id: "dev-other", user_id: "user-OTHER", push_token: "tok-other", enabled: true },
      ],
      tenant_activity_log: [],
    });
    const send = vi.fn(
      async (_msg: PushMessage): Promise<PushDeliveryResult[]> => [
        { token: "tok-1", status: "ok" },
      ],
    );
    const provider: MobilePushProvider = { send };

    await deliverPushForNotification(db, provider, {
      id: "notif-1",
      tenant_id: "tenant-1",
      recipient_external_ref: "customer:cust-1",
      priority: "normal",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0]![0];
    expect(call.to).toEqual(["tok-1"]);
    expect(call.to).not.toContain("tok-other");
  });

  it("never leaks the real subject/body into the push payload — always generic copy", async () => {
    const { db } = makeDb({
      rental_customers: [{ id: "cust-1", auth_user_id: "user-1" }],
      mobile_devices: [{ id: "dev-1", user_id: "user-1", push_token: "tok-1", enabled: true }],
      tenant_activity_log: [],
    });
    const send = vi.fn(
      async (_msg: PushMessage): Promise<PushDeliveryResult[]> => [
        { token: "tok-1", status: "ok" },
      ],
    );
    const provider: MobilePushProvider = { send };

    await deliverPushForNotification(db, provider, {
      id: "notif-1",
      tenant_id: "tenant-1",
      recipient_external_ref: "customer:cust-1",
      priority: "high",
    });

    const call = send.mock.calls[0]![0];
    expect(call.title).not.toContain("R$");
    expect(call.body).not.toMatch(/cliente|contrato|fatura/i);
  });

  it("disables a device when the provider reports DeviceNotRegistered", async () => {
    const { db, updateCalls } = makeDb({
      rental_customers: [{ id: "cust-1", auth_user_id: "user-1" }],
      mobile_devices: [{ id: "dev-1", user_id: "user-1", push_token: "tok-stale", enabled: true }],
      tenant_activity_log: [],
    });
    const provider: MobilePushProvider = {
      send: async () => [{ token: "tok-stale", status: "error", errorCode: "DeviceNotRegistered" }],
    };

    await deliverPushForNotification(db, provider, {
      id: "notif-1",
      tenant_id: "tenant-1",
      recipient_external_ref: "customer:cust-1",
      priority: "normal",
    });

    const disableCall = updateCalls.find((c) => c.table === "mobile_devices");
    expect(disableCall?.ids).toEqual(["dev-1"]);
    expect(disableCall?.patch.enabled).toBe(false);
  });

  it("does nothing (no send, no crash) when the recipient has no registered devices", async () => {
    const { db } = makeDb({
      rental_customers: [{ id: "cust-1", auth_user_id: "user-1" }],
      mobile_devices: [],
      tenant_activity_log: [],
    });
    const send = vi.fn(async (): Promise<PushDeliveryResult[]> => []);
    const provider: MobilePushProvider = { send };

    await deliverPushForNotification(db, provider, {
      id: "notif-1",
      tenant_id: "tenant-1",
      recipient_external_ref: "customer:cust-1",
      priority: "normal",
    });

    expect(send).not.toHaveBeenCalled();
  });

  it("resolves a tenant broadcast to every active staff member's devices", async () => {
    const { db } = makeDb({
      user_profiles: [
        {
          id: "p1",
          tenant_id: "tenant-1",
          auth_user_id: "staff-1",
          status: "active",
          deleted_at: null,
        },
        {
          id: "p2",
          tenant_id: "tenant-1",
          auth_user_id: "staff-2",
          status: "active",
          deleted_at: null,
        },
        {
          id: "p3",
          tenant_id: "tenant-OTHER",
          auth_user_id: "staff-other",
          status: "active",
          deleted_at: null,
        },
      ],
      mobile_devices: [
        { id: "d1", user_id: "staff-1", push_token: "tok-1", enabled: true },
        { id: "d2", user_id: "staff-2", push_token: "tok-2", enabled: true },
        { id: "d3", user_id: "staff-other", push_token: "tok-other", enabled: true },
      ],
      tenant_activity_log: [],
    });
    const send = vi.fn(
      async (_msg: PushMessage): Promise<PushDeliveryResult[]> => [
        { token: "tok-1", status: "ok" },
        { token: "tok-2", status: "ok" },
      ],
    );
    const provider: MobilePushProvider = { send };

    await deliverPushForNotification(db, provider, {
      id: "notif-1",
      tenant_id: "tenant-1",
      recipient_external_ref: "tenant:tenant-1",
      priority: "normal",
    });

    const call = send.mock.calls[0]![0];
    expect(call.to.sort()).toEqual(["tok-1", "tok-2"]);
    expect(call.to).not.toContain("tok-other");
  });
});
