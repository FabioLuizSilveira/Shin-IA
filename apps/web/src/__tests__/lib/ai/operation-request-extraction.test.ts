import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// WAVE 5 — mocks @shina/ai-gateway exactly like messaging-copilot.test.ts:
// never a real model call or credit-ledger touch. Verifies
// extractOperationRequest's safety properties (unassigned/no-history skip,
// fail-closed on invalid JSON, ambiguous fields force confirmation) rather
// than the model's extraction quality.
const mockRunAiGateway = vi.fn();
vi.mock("@shina/ai-gateway", () => ({
  runAiGateway: (...args: unknown[]) => mockRunAiGateway(...args),
}));
vi.mock("@/lib/ai/workspace", () => ({
  ensureDefaultAgentWorkspace: vi.fn().mockResolvedValue("workspace-t1"),
}));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));

const { extractOperationRequest } = await import("@/lib/ai/operation-request-extraction");

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
      body: "Preciso de um ônibus para 46 pessoas de Campinas para São Paulo dia 22, saída às 07:00 e retorno às 18:00.",
      created_at: "2026-01-01T10:00:00Z",
    },
  ];
  return db;
}

describe("WAVE 5 — extractOperationRequest", () => {
  beforeEach(() => {
    mockRunAiGateway.mockClear();
  });

  it("extracts a confident passenger_transport_request with no ambiguous fields", async () => {
    mockRunAiGateway.mockResolvedValueOnce({
      text: JSON.stringify({
        intent: "passenger_transport_request",
        transportFields: {
          origin: "Campinas",
          destination: "São Paulo",
          date: "22",
          departureTime: "07:00",
          returnTime: "18:00",
          passengerCount: 46,
        },
        ambiguousFields: [],
      }),
      creditsConsumed: 4,
    });
    const db = seed();
    const result = await extractOperationRequest(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.extracted).toBe(true);
    expect(result.intent).toBe("passenger_transport_request");
    expect(result.transportFields?.passengerCount).toBe(46);
    expect(result.ambiguousFields).toEqual([]);
    expect(result.needsConfirmation).toBe(false);
    expect(result.creditsConsumed).toBe(4);
  });

  it("strips a fenced code block the model wrapped the JSON in despite instructions", async () => {
    mockRunAiGateway.mockResolvedValueOnce({
      text: '```json\n{"intent":"towing_request","towingFields":{"location":"Av. Paulista"},"ambiguousFields":["customerHint"]}\n```',
      creditsConsumed: 2,
    });
    const db = seed();
    const result = await extractOperationRequest(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.extracted).toBe(true);
    expect(result.intent).toBe("towing_request");
    expect(result.towingFields?.location).toBe("Av. Paulista");
  });

  it("extracts a confident water_tank_request", async () => {
    mockRunAiGateway.mockResolvedValueOnce({
      text: JSON.stringify({
        intent: "water_tank_request",
        waterTankFields: { deliveryLocation: "Sítio Boa Vista", litersRequested: 8000 },
        ambiguousFields: [],
      }),
      creditsConsumed: 2,
    });
    const db = seed();
    const result = await extractOperationRequest(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.extracted).toBe(true);
    expect(result.intent).toBe("water_tank_request");
    expect(result.waterTankFields?.litersRequested).toBe(8000);
    expect(result.needsConfirmation).toBe(false);
  });

  it("needsConfirmation is true whenever ambiguousFields is non-empty — never assumed silently", async () => {
    mockRunAiGateway.mockResolvedValueOnce({
      text: JSON.stringify({
        intent: "passenger_transport_request",
        transportFields: { origin: "Campinas" },
        ambiguousFields: ["destination", "date", "passengerCount"],
      }),
      creditsConsumed: 3,
    });
    const db = seed();
    const result = await extractOperationRequest(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.needsConfirmation).toBe(true);
    expect(result.ambiguousFields).toEqual(["destination", "date", "passengerCount"]);
  });

  it("falls back to unclear (and needsConfirmation) on an invalid intent value from the model", async () => {
    mockRunAiGateway.mockResolvedValueOnce({
      text: JSON.stringify({ intent: "something_the_model_made_up", ambiguousFields: [] }),
      creditsConsumed: 1,
    });
    const db = seed();
    const result = await extractOperationRequest(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.intent).toBe("unclear");
    expect(result.needsConfirmation).toBe(true);
  });

  it("fails closed (extracted: false) when the model doesn't return valid JSON at all", async () => {
    mockRunAiGateway.mockResolvedValueOnce({
      text: "Desculpe, não entendi a solicitação.",
      creditsConsumed: 1,
    });
    const db = seed();
    const result = await extractOperationRequest(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.extracted).toBe(false);
    expect(result.reason).toMatch(/valid JSON/);
  });

  it("never extracts for an unassigned conversation — no clear acting user", async () => {
    const db = seed();
    db.tables.conversations[0].assigned_user_id = null;
    const result = await extractOperationRequest(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.extracted).toBe(false);
    expect(result.reason).toMatch(/unassigned/);
    expect(mockRunAiGateway).not.toHaveBeenCalled();
  });

  it("never extracts when there is no message history", async () => {
    const db = seed();
    db.tables.messages = [];
    const result = await extractOperationRequest(asClient(db), {
      tenantId: "t1",
      conversationId: "conv1",
    });
    expect(result.extracted).toBe(false);
    expect(result.reason).toMatch(/no messages/);
  });

  it("never resolves a conversation belonging to a different tenant", async () => {
    const db = seed();
    const result = await extractOperationRequest(asClient(db), {
      tenantId: "tenant-b",
      conversationId: "conv1",
    });
    expect(result.extracted).toBe(false);
    expect(result.reason).toMatch(/not found/);
  });
});
