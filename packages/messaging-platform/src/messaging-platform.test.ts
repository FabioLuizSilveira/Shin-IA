import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeMessagingProvider } from "./providers/fake.js";
import {
  applyMessagingEvent,
  createMessagingChannel,
  getAccessTokenForChannel,
  markChannelConnected,
} from "./messaging-service.js";
import { evaluateSendPolicy } from "./policy-engine.js";
import { sendOutboundText } from "./outbound.js";
import type { CanonicalMessagingEvent, MessagingChannel } from "./types.js";

process.env.MESSAGING_TOKEN_ENCRYPTION_KEY = "test-key-wave1";

// ── FakeDb — same shape as packages/commercial-platform's own test doubles ─
interface Row {
  [k: string]: unknown;
}
class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private filters: Array<(r: Row) => boolean> = [];
  private orderCol: string | null = null;
  private orderDesc = false;
  // insert/upsert execute immediately (matching real Supabase: the write
  // happens whether or not the caller chains .select()) — matters for
  // fire-and-forget writes like credential upserts that never chain
  // .select().single().
  private inserted: { data: Row | null; error: { code?: string; message?: string } | null } | null =
    null;
  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}
  select() {
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    this.inserted = this.doInsert(row);
    return this;
  }
  update(row: Row) {
    this.op = "update";
    this.payload = row;
    return this;
  }
  upsert(row: Row, opts?: { onConflict?: string }) {
    this.op = "insert";
    this.payload = row;
    const conflictKeys = opts?.onConflict?.split(",") ?? this.db.uniqueKeys[this.table];
    if (conflictKeys) {
      const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
      const existing = rows.find((r) => conflictKeys.every((k) => r[k] === row[k]));
      if (existing) {
        Object.assign(existing, row);
        this.inserted = { data: existing, error: null };
        return this;
      }
    }
    this.inserted = this.doInsert(row);
    return this;
  }
  private doInsert(row: Row): {
    data: Row | null;
    error: { code?: string; message?: string } | null;
  } {
    const uniqueKey = this.db.uniqueKeys[this.table];
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    if (uniqueKey) {
      const clash = rows.find((r) => uniqueKey.every((k) => r[k] === row[k]));
      if (clash) return { data: null, error: { code: "23505" } };
    }
    const created: Row = { id: `${this.table}-${rows.length + 1}`, ...row };
    rows.push(created);
    return { data: created, error: null };
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) {
    this.orderCol = c;
    this.orderDesc = o?.ascending === false;
    return this;
  }
  limit() {
    return this;
  }
  private rows(): Row[] {
    let matched = (this.db.tables[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCol) {
      matched = [...matched].sort((a, b) => {
        const av = String(a[this.orderCol!] ?? "");
        const bv = String(b[this.orderCol!] ?? "");
        return this.orderDesc ? bv.localeCompare(av) : av.localeCompare(bv);
      });
    }
    return matched;
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
  single(): Promise<{ data: Row | null; error: { code?: string; message?: string } | null }> {
    if (this.op === "insert") return Promise.resolve(this.inserted!);
    if (this.op === "update") {
      const rows = this.rows();
      for (const r of rows) Object.assign(r, this.payload);
      const first = rows[0];
      return Promise.resolve(
        first ? { data: first, error: null } : { data: null, error: { message: "nf" } },
      );
    }
    const first = this.rows()[0];
    return Promise.resolve(
      first ? { data: first, error: null } : { data: null, error: { message: "nf" } },
    );
  }
  then(resolve: (v: unknown) => void) {
    if (this.op === "insert") {
      resolve(this.inserted);
      return;
    }
    if (this.op === "update") {
      const rows = this.rows();
      for (const r of rows) Object.assign(r, this.payload);
      resolve({ data: rows, error: null });
      return;
    }
    resolve({ data: this.rows(), error: null });
  }
}
class FakeDb {
  tables: Record<string, Row[]> = {};
  uniqueKeys: Record<string, string[]> = {
    messaging_webhook_events: ["provider", "provider_event_id"],
  };
  from(t: string) {
    return new FakeQuery(this, t);
  }
  // Fake, reversible stand-in for the real pgcrypto RPC wrappers — proves
  // messaging-service.ts round-trips through encryptToken/decryptToken
  // without needing a real Postgres connection in unit tests.
  rpc(fn: string, args: Record<string, unknown>) {
    if (fn === "encrypt_messaging_token") {
      return Promise.resolve({ data: `enc:${args.key}:${args.token}`, error: null });
    }
    if (fn === "decrypt_messaging_token") {
      const raw = args.ciphertext as string;
      const prefix = `enc:${args.key}:`;
      if (!raw.startsWith(prefix))
        return Promise.resolve({ data: null, error: { message: "bad key" } });
      return Promise.resolve({ data: raw.slice(prefix.length), error: null });
    }
    return Promise.resolve({ data: null, error: { message: `unknown rpc ${fn}` } });
  }
}
const asClient = (db: FakeDb) => db as unknown as SupabaseClient;

describe("WAVE 1 FOUNDATION — MessagingChannel lifecycle", () => {
  it("creates a channel pending, then connects it", async () => {
    const db = new FakeDb();
    const channel = await createMessagingChannel(asClient(db), { tenantId: "t1" });
    expect(channel.status).toBe("pending");

    const connected = await markChannelConnected(
      asClient(db),
      channel.id,
      {
        externalBusinessAccountId: "waba-1",
        externalPhoneNumberId: "phone-1",
        externalAccountId: null,
        displayPhoneNumber: "+551190000000",
        displayName: "Test",
      },
      "secret-token",
    );
    expect(connected.status).toBe("connected");
    expect(connected.externalPhoneNumberId).toBe("phone-1");
    // credential row exists but is never part of the returned domain object,
    // and is stored encrypted, never in plain text
    const stored = db.tables.messaging_channel_credentials[0].access_token_enc;
    expect(stored).not.toBe("secret-token");
    expect((connected as unknown as Record<string, unknown>).accessToken).toBeUndefined();
    // round-trips back to the original token through the decrypt RPC
    expect(await getAccessTokenForChannel(asClient(db), channel.id)).toBe("secret-token");
  });

  it("supports multiple channels per tenant (multiple numbers)", async () => {
    const db = new FakeDb();
    const a = await createMessagingChannel(asClient(db), { tenantId: "t1", purpose: "sales" });
    const b = await createMessagingChannel(asClient(db), { tenantId: "t1", purpose: "support" });
    expect(a.id).not.toBe(b.id);
    expect(db.tables.messaging_channels.filter((r) => r.tenant_id === "t1")).toHaveLength(2);
  });
});

describe("WAVE 1 FOUNDATION — provider abstraction / substitutability", () => {
  it("FakeMessagingProvider implements the full MessagingProvider contract", async () => {
    const provider = new FakeMessagingProvider();
    const conn = await provider.connectAccount();
    expect(conn.externalPhoneNumberId).toMatch(/^fake-phone-/);
    const sendResult = await provider.sendText({
      channel: { id: "c1" } as MessagingChannel,
      toExternalId: "5511999999999",
      body: "oi",
    });
    expect(sendResult.providerMessageId).toMatch(/^fake-msg-/);
    expect(provider.sentMessages).toHaveLength(1);
  });

  it("verifyWebhookSubscription only echoes hub.challenge for the right token", () => {
    const provider = new FakeMessagingProvider();
    expect(
      provider.verifyWebhookSubscription({
        "hub.mode": "subscribe",
        "hub.verify_token": "fake-verify-token",
        "hub.challenge": "12345",
      }),
    ).toBe("12345");
    expect(
      provider.verifyWebhookSubscription({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong",
        "hub.challenge": "12345",
      }),
    ).toBeNull();
  });
});

// ── webhook / idempotency / tenant isolation ────────────────────────────
function seed(): FakeDb {
  const db = new FakeDb();
  db.tables.messaging_channels = [
    {
      id: "chan-a",
      tenant_id: "tenant-a",
      provider: "whatsapp",
      external_business_account_id: "waba-a",
      external_phone_number_id: "phone-a",
      external_account_id: null,
      display_phone_number: "+5511900000001",
      display_name: "A",
      status: "connected",
      connection_mode: "cloud_api",
      branch_id: null,
      purpose: null,
      created_at: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      disconnected_at: null,
    },
    {
      id: "chan-b",
      tenant_id: "tenant-b",
      provider: "whatsapp",
      external_business_account_id: "waba-b",
      external_phone_number_id: "phone-b",
      external_account_id: null,
      display_phone_number: "+5511900000002",
      display_name: "B",
      status: "connected",
      connection_mode: "cloud_api",
      branch_id: null,
      purpose: null,
      created_at: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      disconnected_at: null,
    },
  ];
  return db;
}

function inboundEvent(
  phoneNumberId: string,
  msgId: string,
  from = "5511988887777",
): CanonicalMessagingEvent {
  return {
    provider: "whatsapp",
    providerEventId: msgId,
    eventType: "messages",
    kind: "message_received",
    externalPhoneNumberId: phoneNumberId,
    inboundMessage: {
      externalConversationKey: from,
      externalSenderId: from,
      externalSenderName: "Cliente Teste",
      providerMessageId: msgId,
      type: "text",
      body: "Olá",
      mediaRef: null,
      occurredAt: new Date().toISOString(),
      raw: {},
    },
    rawPayload: {},
  };
}

describe("WAVE 1 WEBHOOK — idempotent, tenant resolved server-side", () => {
  it("valid webhook creates a conversation + message under the resolved tenant", async () => {
    const db = seed();
    const result = await applyMessagingEvent(asClient(db), inboundEvent("phone-a", "wamid.1"));
    expect(result.handled).toBe(true);
    expect(result.tenantId).toBe("tenant-a");
    expect(db.tables.conversations).toHaveLength(1);
    expect(db.tables.conversations[0].tenant_id).toBe("tenant-a");
    expect(db.tables.messages).toHaveLength(1);
    expect(db.tables.messages[0].tenant_id).toBe("tenant-a");
  });

  it("duplicate webhook delivery (same provider_event_id) is idempotent — no double insert", async () => {
    const db = seed();
    await applyMessagingEvent(asClient(db), inboundEvent("phone-a", "wamid.dup"));
    const second = await applyMessagingEvent(asClient(db), inboundEvent("phone-a", "wamid.dup"));
    expect(second.duplicate).toBe(true);
    expect(db.tables.messages).toHaveLength(1);
  });

  it("unknown channel (unrecognized externalPhoneNumberId) is logged but not handled", async () => {
    const db = seed();
    const result = await applyMessagingEvent(
      asClient(db),
      inboundEvent("phone-does-not-exist", "wamid.x"),
    );
    expect(result.handled).toBe(false);
    expect(db.tables.conversations ?? []).toHaveLength(0);
    expect(db.tables.messaging_webhook_events).toHaveLength(1);
  });

  it("a second message from the same contact reuses the open conversation", async () => {
    const db = seed();
    await applyMessagingEvent(asClient(db), inboundEvent("phone-a", "wamid.1"));
    await applyMessagingEvent(asClient(db), inboundEvent("phone-a", "wamid.2"));
    expect(db.tables.conversations).toHaveLength(1);
    expect(db.tables.messages).toHaveLength(2);
  });

  it("a status update (message_sent) attaches to the existing outbound message by provider_message_id", async () => {
    const db = seed();
    db.tables.messages = [
      {
        id: "msg-1",
        tenant_id: "tenant-a",
        conversation_id: "conv-1",
        direction: "outbound",
        provider_message_id: "wamid.out.1",
        status: "sent",
      },
    ];
    const event: CanonicalMessagingEvent = {
      provider: "whatsapp",
      providerEventId: "wamid.out.1:delivered",
      eventType: "statuses",
      kind: "message_delivered",
      externalPhoneNumberId: "phone-a",
      statusUpdate: {
        providerMessageId: "wamid.out.1",
        status: "delivered",
        occurredAt: new Date().toISOString(),
      },
      rawPayload: {},
    };
    const result = await applyMessagingEvent(asClient(db), event);
    expect(result.handled).toBe(true);
    expect(db.tables.messages[0].status).toBe("delivered");
  });
});

describe("WAVE 1 TENANT ISOLATION — P0 absolute", () => {
  it("tenant A's inbound message never lands under tenant B, even with an adjacent channel", async () => {
    const db = seed();
    await applyMessagingEvent(asClient(db), inboundEvent("phone-a", "wamid.iso.1"));
    const tenantBRows = db.tables.messages.filter((m) => m.tenant_id === "tenant-b");
    expect(tenantBRows).toHaveLength(0);
  });

  it("a forged externalPhoneNumberId belonging to tenant B never resolves tenant A's conversation", async () => {
    const db = seed();
    await applyMessagingEvent(asClient(db), inboundEvent("phone-a", "wamid.1"));
    const result = await applyMessagingEvent(
      asClient(db),
      inboundEvent("phone-b", "wamid.2", "5511988887777"),
    );
    // same external contact number, but a DIFFERENT channel (tenant B's) —
    // must create a SEPARATE conversation, never reuse tenant A's.
    expect(result.tenantId).toBe("tenant-b");
    expect(db.tables.conversations).toHaveLength(2);
    const convForB = db.tables.conversations.find((c) => c.id === result.conversationId);
    expect(convForB?.tenant_id).toBe("tenant-b");
  });
});

describe("WAVE 1 POLICY — outbound gate (P0)", () => {
  const channel = (): MessagingChannel => ({
    id: "chan-a",
    tenantId: "tenant-a",
    provider: "whatsapp",
    externalBusinessAccountId: "waba-a",
    externalPhoneNumberId: "phone-a",
    externalAccountId: null,
    displayPhoneNumber: null,
    displayName: null,
    status: "connected",
    connectionMode: "cloud_api",
    branchId: null,
    purpose: null,
    createdAt: new Date().toISOString(),
    connectedAt: new Date().toISOString(),
    disconnectedAt: null,
  });

  it("blocks when the channel is not connected", async () => {
    const db = new FakeDb();
    const evalResult = await evaluateSendPolicy(asClient(db), {
      channel: { ...channel(), status: "suspended" },
      tenantId: "tenant-a",
      personId: null,
      purpose: "operational",
      entitlementActive: true,
    });
    expect(evalResult.decision).toBe("BLOCK");
  });

  it("blocks when the entitlement is not active", async () => {
    const db = new FakeDb();
    const evalResult = await evaluateSendPolicy(asClient(db), {
      channel: channel(),
      tenantId: "tenant-a",
      personId: null,
      purpose: "operational",
      entitlementActive: false,
    });
    expect(evalResult.decision).toBe("BLOCK");
  });

  it("blocks marketing without an explicit granted consent", async () => {
    const db = new FakeDb();
    const evalResult = await evaluateSendPolicy(asClient(db), {
      channel: channel(),
      tenantId: "tenant-a",
      personId: "person-1",
      purpose: "marketing",
      entitlementActive: true,
    });
    expect(evalResult.decision).toBe("BLOCK");
  });

  it("allows marketing once consent is granted", async () => {
    const db = new FakeDb();
    db.tables.communication_consents = [
      {
        tenant_id: "tenant-a",
        person_id: "person-1",
        purpose: "marketing",
        status: "granted",
        created_at: "2026-01-01",
      },
    ];
    const evalResult = await evaluateSendPolicy(asClient(db), {
      channel: channel(),
      tenantId: "tenant-a",
      personId: "person-1",
      purpose: "marketing",
      entitlementActive: true,
    });
    expect(evalResult.decision).toBe("ALLOW");
  });

  it("does NOT infer marketing consent from operational consent (spec section 14)", async () => {
    const db = new FakeDb();
    db.tables.communication_consents = [
      {
        tenant_id: "tenant-a",
        person_id: "person-1",
        purpose: "operational",
        status: "granted",
        created_at: "2026-01-01",
      },
    ];
    const evalResult = await evaluateSendPolicy(asClient(db), {
      channel: channel(),
      tenantId: "tenant-a",
      personId: "person-1",
      purpose: "marketing",
      entitlementActive: true,
    });
    expect(evalResult.decision).toBe("BLOCK");
  });

  it("respects a revoked operational consent (opt-out)", async () => {
    const db = new FakeDb();
    db.tables.communication_consents = [
      {
        tenant_id: "tenant-a",
        person_id: "person-1",
        purpose: "operational",
        status: "revoked",
        created_at: "2026-01-01",
      },
    ];
    const evalResult = await evaluateSendPolicy(asClient(db), {
      channel: channel(),
      tenantId: "tenant-a",
      personId: "person-1",
      purpose: "operational",
      entitlementActive: true,
    });
    expect(evalResult.decision).toBe("BLOCK");
  });

  it("sendOutboundText never calls the provider when policy blocks", async () => {
    const db = new FakeDb();
    const provider = new FakeMessagingProvider();
    const result = await sendOutboundText(asClient(db), provider, {
      channel: { ...channel(), status: "suspended" },
      conversationId: "conv-1",
      toExternalId: "5511988887777",
      body: "oi",
      personId: null,
      purpose: "operational",
      entitlementActive: true,
      senderUserId: "user-1",
    });
    expect(result.policy.decision).toBe("BLOCK");
    expect(provider.sentMessages).toHaveLength(0);
    expect(db.tables.messages ?? []).toHaveLength(0);
  });

  it("sendOutboundText calls the provider and records usage when policy allows", async () => {
    const db = new FakeDb();
    const provider = new FakeMessagingProvider();
    const result = await sendOutboundText(asClient(db), provider, {
      channel: channel(),
      conversationId: "conv-1",
      toExternalId: "5511988887777",
      body: "Seu contrato está pronto.",
      personId: null,
      purpose: "operational",
      entitlementActive: true,
      senderUserId: "user-1",
    });
    expect(result.policy.decision).toBe("ALLOW");
    expect(provider.sentMessages).toHaveLength(1);
    expect(db.tables.messages[0].status).toBe("sent");
    expect(db.tables.messaging_usage_events).toHaveLength(1);
  });
});
