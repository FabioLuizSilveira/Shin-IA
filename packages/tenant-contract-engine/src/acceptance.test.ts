import { describe, expect, it, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordContractAcceptance, hasAcceptedContract } from "./acceptance.js";

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private op: "select" | "insert" = "select";
  private row: Row = {};
  private filters: Array<{ col: string; val: unknown }> = [];

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select() {
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
  limit(_n: number) {
    return this;
  }
  single() {
    return this.execute(true);
  }
  maybeSingle() {
    return this.execute(false);
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => row[f.col] === f.val);
  }

  private execute(errorIfMissing: boolean) {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    if (this.op === "insert") {
      const id = `${this.table}-${rows.length + 1}`;
      const newRow = { ...this.row, id };
      rows.push(newRow);
      return Promise.resolve({ data: newRow, error: null });
    }
    const matched = rows.filter((r) => this.matches(r));
    if (matched.length === 0 && errorIfMissing) {
      return Promise.resolve({ data: null, error: { message: "not found" } });
    }
    return Promise.resolve({ data: matched[0] ?? null, error: null });
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

// recordContractAcceptance re-derives template_version_id/snapshot_id from
// the `contracts` row rather than trusting the caller's input — every test
// needs a matching contracts row seeded first.
function seedContract(
  db: SupabaseClient,
  id: string,
  templateVersionId: string,
  snapshotId: string,
) {
  const fake = db as unknown as FakeDb;
  (fake.tables.contracts ??= []).push({
    id,
    template_version_id: templateVersionId,
    snapshot_id: snapshotId,
  });
}

describe("recordContractAcceptance", () => {
  let db: SupabaseClient;

  beforeEach(() => {
    db = makeDb();
  });

  it("records a customer acceptance and stamps request context server-side", async () => {
    seedContract(db, "contract-1", "ver-1", "snap-1");
    const result = await recordContractAcceptance(db, {
      tenantId: "tenant-1",
      partyType: "customer",
      userId: "user-1",
      customerId: "cust-1",
      contractId: "contract-1",
      contractVersionId: "ver-1",
      snapshotId: "snap-1",
      documentHash: "deadbeef",
      acceptanceMethod: "clickwrap",
      request: { ipAddress: "203.0.113.4", userAgent: "vitest" },
    });

    expect(result.acceptanceId).toBeTruthy();
    const fake = db as unknown as FakeDb;
    const acceptance = fake.tables.tenant_contract_acceptances[0];
    expect(acceptance.party_type).toBe("customer");
    expect(acceptance.customer_id).toBe("cust-1");
    expect(acceptance.ip_address).toBe("203.0.113.4");
    expect("accepted_at" in acceptance).toBe(false); // DB default, not client-supplied
  });

  it("records an operator acknowledgement distinctly from clickwrap", async () => {
    seedContract(db, "contract-2", "ver-2", "snap-2");
    await recordContractAcceptance(db, {
      tenantId: "tenant-1",
      partyType: "operator",
      userId: "staff-1",
      operatorId: "op-1",
      contractId: "contract-2",
      contractVersionId: "ver-2",
      snapshotId: "snap-2",
      documentHash: "deadbeef",
      acceptanceMethod: "operator_acknowledgement",
      request: { ipAddress: null, userAgent: null },
      metadata: { acknowledged_on_behalf_of_operator_id: "op-1" },
    });

    const fake = db as unknown as FakeDb;
    const acceptance = fake.tables.tenant_contract_acceptances[0];
    expect(acceptance.acceptance_method).toBe("operator_acknowledgement");
    expect(acceptance.operator_id).toBe("op-1");
  });

  it("rejects a customer acceptance with no customerId", async () => {
    seedContract(db, "contract-1", "ver-1", "snap-1");
    await expect(
      recordContractAcceptance(db, {
        tenantId: "tenant-1",
        partyType: "customer",
        userId: "user-1",
        contractId: "contract-1",
        contractVersionId: "ver-1",
        snapshotId: "snap-1",
        documentHash: "deadbeef",
        acceptanceMethod: "clickwrap",
        request: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toThrow(/customerId/);
  });

  it("rejects when contractVersionId does not match the version actually resolved for this contract", async () => {
    seedContract(db, "contract-1", "ver-1", "snap-1");
    await expect(
      recordContractAcceptance(db, {
        tenantId: "tenant-1",
        partyType: "customer",
        userId: "user-1",
        customerId: "cust-1",
        contractId: "contract-1",
        contractVersionId: "ver-DIFFERENT",
        snapshotId: "snap-1",
        documentHash: "deadbeef",
        acceptanceMethod: "clickwrap",
        request: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toThrow(/does not match the version resolved/);
  });

  it("rejects when snapshotId does not match the snapshot generated for this contract", async () => {
    seedContract(db, "contract-1", "ver-1", "snap-1");
    await expect(
      recordContractAcceptance(db, {
        tenantId: "tenant-1",
        partyType: "customer",
        userId: "user-1",
        customerId: "cust-1",
        contractId: "contract-1",
        contractVersionId: "ver-1",
        snapshotId: "snap-DIFFERENT",
        documentHash: "deadbeef",
        acceptanceMethod: "clickwrap",
        request: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toThrow(/does not match the snapshot generated/);
  });

  it("rejects when the contract doesn't exist", async () => {
    await expect(
      recordContractAcceptance(db, {
        tenantId: "tenant-1",
        partyType: "customer",
        userId: "user-1",
        customerId: "cust-1",
        contractId: "contract-missing",
        contractVersionId: "ver-1",
        snapshotId: "snap-1",
        documentHash: "deadbeef",
        acceptanceMethod: "clickwrap",
        request: { ipAddress: null, userAgent: null },
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("hasAcceptedContract", () => {
  let db: SupabaseClient;

  beforeEach(() => {
    db = makeDb();
  });

  it("is false before any acceptance, true after", async () => {
    seedContract(db, "contract-1", "ver-1", "snap-1");
    expect(
      await hasAcceptedContract(db, {
        contractId: "contract-1",
        partyType: "customer",
        customerId: "cust-1",
      }),
    ).toBe(false);

    await recordContractAcceptance(db, {
      tenantId: "tenant-1",
      partyType: "customer",
      userId: "user-1",
      customerId: "cust-1",
      contractId: "contract-1",
      contractVersionId: "ver-1",
      snapshotId: "snap-1",
      documentHash: "deadbeef",
      acceptanceMethod: "clickwrap",
      request: { ipAddress: null, userAgent: null },
    });

    expect(
      await hasAcceptedContract(db, {
        contractId: "contract-1",
        partyType: "customer",
        customerId: "cust-1",
      }),
    ).toBe(true);
  });

  it("does not confuse an operator acknowledgement with a customer acceptance on the same contract", async () => {
    seedContract(db, "contract-1", "ver-1", "snap-1");
    await recordContractAcceptance(db, {
      tenantId: "tenant-1",
      partyType: "operator",
      userId: "staff-1",
      operatorId: "op-1",
      contractId: "contract-1",
      contractVersionId: "ver-1",
      snapshotId: "snap-1",
      documentHash: "deadbeef",
      acceptanceMethod: "operator_acknowledgement",
      request: { ipAddress: null, userAgent: null },
    });

    expect(
      await hasAcceptedContract(db, {
        contractId: "contract-1",
        partyType: "customer",
        customerId: "cust-1",
      }),
    ).toBe(false);
    expect(
      await hasAcceptedContract(db, {
        contractId: "contract-1",
        partyType: "operator",
        operatorId: "op-1",
      }),
    ).toBe(true);
  });
});
