import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applySignatureEvent, createSignatureRequest } from "./signature-service.js";
import { FakeSignatureProvider } from "./providers/fake.js";
import type { CreateSignatureRequestInput } from "./types.js";

// ── Minimal in-memory Supabase fake ────────────────────────────────────────
// Same spirit as billing-platform's sync-webhook.test.ts fake — implements
// only the chains this package's service functions use, with real
// unique-index behavior on signature_webhook_events(provider,
// provider_event_id) so the idempotency path is actually exercised.

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
  private row: Row | Row[] = {};
  private filters: Array<{ kind: "eq" | "in"; col: string; val: unknown }> = [];
  private wantSingle = false;
  private wantMaybe = false;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  insert(row: Row | Row[]) {
    this.op = "insert";
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
  in(col: string, vals: unknown[]) {
    this.filters.push({ kind: "in", col, val: vals });
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
      f.kind === "eq" ? row[f.col] === f.val : (f.val as unknown[]).includes(row[f.col]),
    );
  }

  private execute(): {
    data: Row | Row[] | null;
    error: { code?: string; message: string } | null;
  } {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);

    if (this.op === "insert") {
      const toInsert = Array.isArray(this.row) ? this.row : [this.row];
      const uniqueCols =
        this.table === "signature_webhook_events" ? ["provider", "provider_event_id"] : null;
      const inserted: Row[] = [];
      for (const r of toInsert) {
        if (uniqueCols && rows.some((existing) => uniqueCols.every((c) => existing[c] === r[c]))) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        const withId = { id: `id-${this.db.nextId++}`, ...r };
        rows.push(withId);
        inserted.push(withId);
      }
      return { data: Array.isArray(this.row) ? inserted : inserted[0], error: null };
    }

    if (this.op === "update") {
      const matched = rows.filter((r) => this.matches(r));
      matched.forEach((r) => Object.assign(r, this.row));
      return { data: matched[0] ?? null, error: null };
    }

    const matched = rows.filter((r) => this.matches(r));
    return { data: matched, error: null };
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
  storage = {
    from: (_bucket: string) => ({
      upload: async (_path: string, _content: unknown, _opts: unknown) => ({
        data: { path: _path },
        error: null,
      }),
    }),
  };
}

function seedContract(db: FakeDb, contractId: string, versionId: string, snapshotId: string) {
  db.tables["contracts"] = db.tables["contracts"] ?? [];
  db.tables["contracts"].push({
    id: contractId,
    template_version_id: versionId,
    snapshot_id: snapshotId,
  });
}

function baseInput(overrides?: Partial<CreateSignatureRequestInput>): CreateSignatureRequestInput {
  return {
    tenantId: "tenant-1",
    contractId: "contract-1",
    contractVersionId: "version-1",
    snapshotId: "snapshot-1",
    documentContent: new TextEncoder().encode("conteúdo do contrato congelado"),
    documentContentType: "application/pdf",
    documentName: "Contrato de Locação.pdf",
    signers: [
      {
        role: "customer",
        name: "Cliente Exemplo",
        email: "cliente@example.com",
        partyType: "customer",
        userId: "user-customer-1",
        customerId: "customer-1",
      },
      {
        role: "operator",
        name: "Operador Exemplo",
        email: "operador@example.com",
        partyType: "operator",
        userId: "user-operator-1",
        operatorId: "operator-1",
      },
    ],
    ...overrides,
  };
}

describe("createSignatureRequest", () => {
  it("creates a request + signers and returns them sent, with provider-assigned external ids", async () => {
    const db = new FakeDb();
    seedContract(db, "contract-1", "version-1", "snapshot-1");
    const provider = new FakeSignatureProvider("fake");

    const result = await createSignatureRequest(
      db as unknown as SupabaseClient,
      provider,
      baseInput(),
    );

    expect(result.status).toBe("sent");
    expect(result.providerRequestId).toBeTruthy();

    const signers = db.tables["signature_signers"];
    expect(signers).toHaveLength(2);
    expect(signers.every((s) => typeof s.provider_external_id === "string")).toBe(true);
  });

  it("rejects a contractVersionId/snapshotId that doesn't match the contract row", async () => {
    const db = new FakeDb();
    seedContract(db, "contract-1", "version-1", "snapshot-1");
    const provider = new FakeSignatureProvider("fake");

    await expect(
      createSignatureRequest(
        db as unknown as SupabaseClient,
        provider,
        baseInput({ snapshotId: "wrong-snapshot" }),
      ),
    ).rejects.toThrow(/snapshotId does not match/);
  });
});

describe("applySignatureEvent", () => {
  async function createAndSend(db: FakeDb, provider: FakeSignatureProvider) {
    seedContract(db, "contract-1", "version-1", "snapshot-1");
    return createSignatureRequest(db as unknown as SupabaseClient, provider, baseInput());
  }

  it("is idempotent — a replayed provider_event_id changes nothing", async () => {
    const db = new FakeDb();
    const provider = new FakeSignatureProvider("fake");
    const created = await createAndSend(db, provider);

    const [signedEvent] = await provider.normalizeWebhook(
      JSON.stringify({
        type: "signature_completed",
        eventId: "evt-completed-1",
        requestId: created.providerRequestId,
      }),
      {},
    );

    const first = await applySignatureEvent(db as unknown as SupabaseClient, provider, signedEvent);
    const replay = await applySignatureEvent(
      db as unknown as SupabaseClient,
      provider,
      signedEvent,
    );

    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(db.tables["signature_artifacts"]).toHaveLength(1);
  });

  it("records one contract acceptance per customer/operator signer on signature_completed", async () => {
    const db = new FakeDb();
    const provider = new FakeSignatureProvider("fake");
    const created = await createAndSend(db, provider);

    const [signedEvent] = await provider.normalizeWebhook(
      JSON.stringify({ type: "signature_completed", requestId: created.providerRequestId }),
      {},
    );
    await applySignatureEvent(db as unknown as SupabaseClient, provider, signedEvent);

    expect(db.tables["signature_requests"][0].status).toBe("signed");
    expect(db.tables["tenant_contract_acceptances"]).toHaveLength(2);
    const methods = db.tables["tenant_contract_acceptances"].map((r) => r.acceptance_method);
    expect(methods.every((m) => m === "electronic_signature_provider")).toBe(true);
  });
});

describe("FakeSignatureProvider — smoke coverage of the interface's other methods", () => {
  it("getRequest / getSigningSession / cancelRequest all work against a created request", async () => {
    const provider = new FakeSignatureProvider("fake");
    const created = await provider.createRequest(baseInput());

    const fetched = await provider.getRequest(created.providerRequestId);
    expect(fetched?.status).toBe("sent");

    const session = await provider.getSigningSession(
      created.providerRequestId,
      created.signers[0].externalId,
    );
    expect(session.signingUrl).toContain(created.signers[0].externalId);

    await provider.cancelRequest(created.providerRequestId);
    const afterCancel = await provider.getRequest(created.providerRequestId);
    expect(afterCancel?.status).toBe("cancelled");
  });
});

// ── Substitutability test (spec section 44) ─────────────────────────────────
// Proves two independently-instantiated providers can coexist against the
// same service layer, with per-request provider immutability preserved,
// and that normalizeWebhook() itself (not a bypass) is what produces the
// canonical events applySignatureEvent consumes.
describe("provider substitutability", () => {
  it("two swappable providers coexist; each request keeps its own provider forever", async () => {
    const db = new FakeDb();
    seedContract(db, "contract-1", "version-1", "snapshot-1");
    seedContract(db, "contract-2", "version-1", "snapshot-1");

    const providerA = new FakeSignatureProvider("fake");
    const providerB = new FakeSignatureProvider("fake_alt");

    const requestA = await createSignatureRequest(
      db as unknown as SupabaseClient,
      providerA,
      baseInput({ contractId: "contract-1" }),
    );
    const requestB = await createSignatureRequest(
      db as unknown as SupabaseClient,
      providerB,
      baseInput({ contractId: "contract-2" }),
    );

    expect(requestA.provider).toBe("fake");
    expect(requestB.provider).toBe("fake_alt");

    const [eventA] = await providerA.normalizeWebhook(
      JSON.stringify({ type: "signature_completed", requestId: requestA.providerRequestId }),
      {},
    );
    const [eventB] = await providerB.normalizeWebhook(
      JSON.stringify({ type: "signature_completed", requestId: requestB.providerRequestId }),
      {},
    );

    await applySignatureEvent(db as unknown as SupabaseClient, providerA, eventA);
    await applySignatureEvent(db as unknown as SupabaseClient, providerB, eventB);

    const rows = db.tables["signature_requests"];
    const rowA = rows.find((r) => r.id === requestA.id)!;
    const rowB = rows.find((r) => r.id === requestB.id)!;

    expect(rowA.provider).toBe("fake");
    expect(rowB.provider).toBe("fake_alt");
    expect(rowA.status).toBe("signed");
    expect(rowB.status).toBe("signed");
    expect(db.tables["tenant_contract_acceptances"]).toHaveLength(4);
  });
});
