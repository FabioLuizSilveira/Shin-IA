import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveContactByPhone } from "./contact-resolver.js";
import {
  applyMessagingEvent,
  createMessagingChannel,
  markChannelConnected,
} from "./messaging-service.js";
import {
  assignConversation,
  closeConversation,
  getUnreadCounts,
  listConversations,
  reopenConversation,
} from "./conversation-service.js";
import { getConsentHistory, grantConsent, revokeConsent } from "./consent-service.js";
import {
  applyTemplateStatusFromProvider,
  createTemplateDraft,
  listTemplates,
  submitTemplateForApproval,
} from "./template-service.js";
import { getUsageSummary } from "./usage-service.js";
import type { CanonicalMessagingEvent } from "./types.js";

process.env.MESSAGING_TOKEN_ENCRYPTION_KEY = "test-key-wave2";

// ── FakeDb (same shape as messaging-platform.test.ts) ───────────────────
interface Row {
  [k: string]: unknown;
}
class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private filters: Array<(r: Row) => boolean> = [];
  private orderCol: string | null = null;
  private orderDesc = false;
  private limitN: number | null = null;
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
  upsert(row: Row, opts?: { onConflict?: string }) {
    this.op = "insert";
    this.payload = row;
    const conflictKeys = opts?.onConflict?.split(",");
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
  update(row: Row) {
    this.op = "update";
    this.payload = row;
    return this;
  }
  private doInsert(row: Row) {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    const created: Row = { id: `${this.table}-${rows.length + 1}`, ...row };
    rows.push(created);
    return { data: created, error: null };
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  is(c: string, v: null) {
    this.filters.push((r) => (r[c] ?? null) === v);
    return this;
  }
  not(c: string, _op: string, v: null) {
    this.filters.push((r) => (r[c] ?? null) !== v);
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
  gte(c: string, v: unknown) {
    this.filters.push((r) => String(r[c]) >= String(v));
    return this;
  }
  or() {
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) {
    this.orderCol = c;
    this.orderDesc = o?.ascending === false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
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
    if (this.limitN !== null) matched = matched.slice(0, this.limitN);
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
  single() {
    return this.maybeSingle();
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

describe("WAVE 2 — ContactResolver", () => {
  it("resolves a rental customer by phone within the tenant", async () => {
    const db = new FakeDb();
    db.tables.rental_customer_organizations = [
      {
        rental_customer_id: "rc1",
        tenant_id: "t1",
        rental_customers: { id: "rc1", full_name: "Maria Cliente", phone: "+55 11 98888-7777" },
      },
    ];
    const resolved = await resolveContactByPhone(asClient(db), "t1", "5511988887777");
    expect(resolved.type).toBe("customer");
    expect(resolved.customerId).toBe("rc1");
    expect(resolved.displayName).toBe("Maria Cliente");
  });

  it("resolves an operator by phone, tenant-scoped", async () => {
    const db = new FakeDb();
    db.tables.rental_customer_organizations = [];
    db.tables.operators = [
      { id: "op1", tenant_id: "t1", full_name: "João Motorista", phone: "11977776666" },
    ];
    const resolved = await resolveContactByPhone(asClient(db), "t1", "+55 11 97777-6666");
    expect(resolved.type).toBe("operator");
    expect(resolved.operatorId).toBe("op1");
  });

  it("never resolves a contact belonging to a different tenant", async () => {
    const db = new FakeDb();
    db.tables.rental_customer_organizations = [
      {
        rental_customer_id: "rc1",
        tenant_id: "tenant-b",
        rental_customers: { id: "rc1", full_name: "Cliente B", phone: "5511988887777" },
      },
    ];
    db.tables.operators = [];
    db.tables.persons = [];
    db.tables.organizations = [];
    const resolved = await resolveContactByPhone(asClient(db), "tenant-a", "5511988887777");
    expect(resolved.type).toBe("unknown");
  });

  it("falls back to unknown when nothing matches", async () => {
    const db = new FakeDb();
    const resolved = await resolveContactByPhone(asClient(db), "t1", "5511900000000");
    expect(resolved.type).toBe("unknown");
    expect(resolved.customerId).toBeNull();
  });

  // Regression: an earlier version prefiltered operators/persons/
  // organizations with a raw SQL ILIKE over the digit suffix, which
  // silently missed real matches whenever the stored phone had a
  // formatting separator (dash/space) inside the matched digit run —
  // confirmed live against hosted Supabase before this fix.
  it("resolves a dash-formatted operator phone (no ILIKE false negative)", async () => {
    const db = new FakeDb();
    db.tables.operators = [
      { id: "op1", tenant_id: "t1", full_name: "Motorista", phone: "+55 11 91234-5678" },
    ];
    const resolved = await resolveContactByPhone(asClient(db), "t1", "5511912345678");
    expect(resolved.type).toBe("operator");
    expect(resolved.operatorId).toBe("op1");
  });
});

describe("WAVE 2 — inbound message resolves and stamps the participant/sender", () => {
  it("an inbound message from a known rental customer is stamped as a customer message", async () => {
    const db = new FakeDb();
    const channel = await createMessagingChannel(asClient(db), { tenantId: "t1" });
    await markChannelConnected(
      asClient(db),
      channel.id,
      {
        externalBusinessAccountId: "waba",
        externalPhoneNumberId: "phone-1",
        externalAccountId: null,
        displayPhoneNumber: null,
        displayName: null,
      },
      "token",
    );
    db.tables.rental_customer_organizations = [
      {
        rental_customer_id: "rc1",
        tenant_id: "t1",
        rental_customers: { id: "rc1", full_name: "Maria Cliente", phone: "5511988887777" },
      },
    ];

    const event: CanonicalMessagingEvent = {
      provider: "whatsapp",
      providerEventId: "wamid.1",
      eventType: "messages",
      kind: "message_received",
      externalPhoneNumberId: "phone-1",
      inboundMessage: {
        externalConversationKey: "5511988887777",
        externalSenderId: "5511988887777",
        externalSenderName: "Maria",
        providerMessageId: "wamid.1",
        type: "text",
        body: "Oi",
        mediaRef: null,
        occurredAt: new Date().toISOString(),
        raw: {},
      },
      rawPayload: {},
    };
    const result = await applyMessagingEvent(asClient(db), event);
    expect(result.handled).toBe(true);
    const conv = db.tables.conversations.find((c) => c.id === result.conversationId)!;
    expect(conv.customer_id).toBe("rc1");
    const msg = db.tables.messages.find((m) => m.id === result.messageId)!;
    expect(msg.sender_type).toBe("customer");
    const participant = db.tables.conversation_participants[0];
    expect(participant.customer_id).toBe("rc1");
    expect(participant.participant_type).toBe("customer");
  });
});

describe("WAVE 2 — conversation assignment / close / filters", () => {
  function seedConversations(): FakeDb {
    const db = new FakeDb();
    db.tables.conversations = [
      {
        id: "c1",
        tenant_id: "t1",
        status: "open",
        assigned_user_id: null,
        customer_id: "rc1",
        contact_id: null,
        last_message_at: "2026-01-03",
      },
      {
        id: "c2",
        tenant_id: "t1",
        status: "open",
        assigned_user_id: "u1",
        customer_id: null,
        contact_id: "p1",
        last_message_at: "2026-01-02",
      },
      {
        id: "c3",
        tenant_id: "t1",
        status: "closed",
        assigned_user_id: "u1",
        customer_id: "rc2",
        contact_id: null,
        last_message_at: "2026-01-01",
      },
      {
        id: "c4",
        tenant_id: "t2",
        status: "open",
        assigned_user_id: null,
        customer_id: "rc3",
        contact_id: null,
        last_message_at: "2026-01-04",
      },
    ];
    return db;
  }

  it("lists only the requesting tenant's conversations", async () => {
    const db = seedConversations();
    const list = await listConversations(asClient(db), { tenantId: "t1" });
    expect(list.every((c) => c.tenantId === "t1")).toBe(true);
    expect(list.some((c) => c.id === "c4")).toBe(false);
  });

  it("filters unassigned vs mine vs closed", async () => {
    const db = seedConversations();
    const unassigned = await listConversations(asClient(db), {
      tenantId: "t1",
      filter: "unassigned",
    });
    expect(unassigned.map((c) => c.id)).toEqual(["c1"]);

    const mine = await listConversations(asClient(db), {
      tenantId: "t1",
      filter: "mine",
      userId: "u1",
    });
    expect(mine.map((c) => c.id).sort()).toEqual(["c2", "c3"]);

    const closed = await listConversations(asClient(db), { tenantId: "t1", filter: "closed" });
    expect(closed.map((c) => c.id)).toEqual(["c3"]);
  });

  it("assigns and closes a conversation, tenant-scoped", async () => {
    const db = seedConversations();
    await assignConversation(asClient(db), { tenantId: "t1", conversationId: "c1", userId: "u2" });
    expect(db.tables.conversations.find((c) => c.id === "c1")!.assigned_user_id).toBe("u2");

    await closeConversation(asClient(db), { tenantId: "t1", conversationId: "c1" });
    expect(db.tables.conversations.find((c) => c.id === "c1")!.status).toBe("closed");

    await reopenConversation(asClient(db), { tenantId: "t1", conversationId: "c1" });
    expect(db.tables.conversations.find((c) => c.id === "c1")!.status).toBe("open");
  });

  it("computes unread counts as inbound messages since the last outbound reply", async () => {
    const db = new FakeDb();
    db.tables.conversations = [{ id: "c1", tenant_id: "t1", status: "open" }];
    db.tables.messages = [
      { id: "m1", conversation_id: "c1", direction: "inbound", created_at: "2026-01-01T10:00:00Z" },
      {
        id: "m2",
        conversation_id: "c1",
        direction: "outbound",
        created_at: "2026-01-01T10:05:00Z",
      },
      { id: "m3", conversation_id: "c1", direction: "inbound", created_at: "2026-01-01T10:10:00Z" },
      { id: "m4", conversation_id: "c1", direction: "inbound", created_at: "2026-01-01T10:15:00Z" },
    ];
    const unread = await getUnreadCounts(asClient(db), "t1");
    expect(unread).toEqual([{ conversationId: "c1", unreadCount: 2 }]);
  });
});

describe("WAVE 2 — consent (LGPD)", () => {
  it("grant then revoke produces a history without mutating past rows", async () => {
    const db = new FakeDb();
    await grantConsent(asClient(db), {
      tenantId: "t1",
      personId: "p1",
      purpose: "marketing",
      source: "opt-in form",
    });
    await revokeConsent(asClient(db), {
      tenantId: "t1",
      personId: "p1",
      purpose: "marketing",
      source: "customer request",
    });
    const history = await getConsentHistory(asClient(db), "t1", "p1");
    expect(history).toHaveLength(2);
    expect(history.some((h) => h.status === "granted")).toBe(true);
    expect(history.some((h) => h.status === "revoked")).toBe(true);
  });
});

describe("WAVE 2 — templates", () => {
  it("a draft can be submitted, but never locally auto-approved", async () => {
    const db = new FakeDb();
    const draft = await createTemplateDraft(asClient(db), {
      tenantId: "t1",
      name: "contrato_pronto",
      language: "pt_BR",
      category: "UTILITY",
      components: [{ type: "BODY", text: "Seu contrato está pronto." }],
    });
    expect(draft.status).toBe("draft");
    const submitted = await submitTemplateForApproval(asClient(db), {
      tenantId: "t1",
      templateId: draft.id,
    });
    expect(submitted.status).toBe("submitted");
    // cannot re-submit an already-submitted template
    await expect(
      submitTemplateForApproval(asClient(db), { tenantId: "t1", templateId: draft.id }),
    ).rejects.toThrow(/cannot submit/);
  });

  it("only a provider-confirmed event can approve a template", async () => {
    const db = new FakeDb();
    const draft = await createTemplateDraft(asClient(db), {
      tenantId: "t1",
      name: "lembrete",
      language: "pt_BR",
      category: "UTILITY",
      components: [],
    });
    await applyTemplateStatusFromProvider(asClient(db), {
      templateId: draft.id,
      status: "approved",
      providerTemplateId: "meta-tpl-123",
    });
    const list = await listTemplates(asClient(db), "t1");
    expect(list.find((t) => t.id === draft.id)?.status).toBe("approved");
    expect(list.find((t) => t.id === draft.id)?.providerTemplateId).toBe("meta-tpl-123");
  });
});

describe("WAVE 2 — usage metering", () => {
  it("summarizes usage events by category and type, tenant-scoped", async () => {
    const db = new FakeDb();
    db.tables.messaging_usage_events = [
      { tenant_id: "t1", category: "operational", message_type: "text", occurred_at: "2026-01-01" },
      {
        tenant_id: "t1",
        category: "operational",
        message_type: "template",
        occurred_at: "2026-01-02",
      },
      {
        tenant_id: "t1",
        category: "marketing",
        message_type: "template",
        occurred_at: "2026-01-03",
      },
      { tenant_id: "t2", category: "operational", message_type: "text", occurred_at: "2026-01-01" },
    ];
    const summary = await getUsageSummary(asClient(db), "t1");
    expect(summary.totalMessages).toBe(3);
    expect(summary.byCategory).toEqual({ operational: 2, marketing: 1 });
    expect(summary.byType).toEqual({ text: 1, template: 2 });
  });
});
