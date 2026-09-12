import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 4 — mocks @shina/ai-gateway so this never makes a real model call or
// touches the real credit ledger; verifies generateCopilotSuggestion's own
// safety properties (never suggests for an unassigned conversation, never
// suggests with no history, attributes the suggestion to the assigned
// operator, never crosses tenants) rather than the model's output quality.
vi.mock("@shina/ai-gateway", () => ({
  runAiGateway: vi
    .fn()
    .mockResolvedValue({ text: "Claro! Vou verificar e te retorno.", creditsConsumed: 3 }),
}));
vi.mock("@/lib/ai/workspace", () => ({
  ensureDefaultAgentWorkspace: vi.fn().mockResolvedValue("workspace-t1"),
}));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));

const { generateCopilotSuggestion } = await import("@/lib/ai/messaging-copilot");
const { runAiGateway } = await import("@shina/ai-gateway");

interface Row {
  [k: string]: unknown;
}
class FakeQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private limitN: number | null = null;
  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}
  select() {
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  private rows() {
    let matched = (this.db.tables[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
    if (this.limitN !== null) matched = matched.slice(0, this.limitN);
    return matched;
  }
  maybeSingle() {
    return Promise.resolve({ data: this.rows()[0] ?? null, error: null });
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
  db.tables.conversations = [
    {
      id: "conv1",
      tenant_id: "t1",
      messaging_channel_id: "chan1",
      status: "open",
      assigned_user_id: "user1",
    },
  ];
  db.tables.messages = [
    {
      id: "m1",
      tenant_id: "t1",
      conversation_id: "conv1",
      direction: "inbound",
      type: "text",
      body: "Qual o status do meu contrato?",
      created_at: "2026-01-01T10:00:00Z",
    },
  ];
  return db;
}

describe("WAVE 4 — generateCopilotSuggestion (COPILOT mode)", () => {
  it("suggests a reply and attributes it to the assigned operator", async () => {
    const db = seed();
    const result = await generateCopilotSuggestion(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.suggested).toBe(true);
    expect(result.text).toContain("Claro");
    expect(result.creditsConsumed).toBe(3);
    expect(runAiGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        ctx: expect.objectContaining({ userId: "user1", tenantId: "t1" }),
      }),
    );
  });

  it("never suggests for an unassigned conversation — no clear acting user", async () => {
    const db = seed();
    db.tables.conversations[0].assigned_user_id = null;
    const result = await generateCopilotSuggestion(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.suggested).toBe(false);
    expect(result.reason).toMatch(/unassigned/);
  });

  it("never suggests when there is no message history", async () => {
    const db = seed();
    db.tables.messages = [];
    const result = await generateCopilotSuggestion(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.suggested).toBe(false);
    expect(result.reason).toMatch(/no messages/);
  });

  it("never resolves a conversation belonging to a different tenant", async () => {
    const db = seed();
    const result = await generateCopilotSuggestion(asClient(db), {
      tenantId: "tenant-b",
      conversationId: "conv1",
    });
    expect(result.suggested).toBe(false);
    expect(result.reason).toMatch(/not found/);
  });
});
