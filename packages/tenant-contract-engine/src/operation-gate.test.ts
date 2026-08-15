import { describe, expect, it, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OperationContractGate } from "./operation-gate.js";

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private filters: Array<{ col: string; val: unknown }> = [];
  private orderCol: string | null = null;
  private orderDesc = false;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }
  eq(col: string, val: unknown) {
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
    return this.execute(true);
  }
  maybeSingle() {
    return this.execute(true);
  }
  then(resolve: (v: unknown) => void) {
    resolve(this.execute(false));
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => row[f.col] === f.val);
  }

  private execute(wantSingle: boolean) {
    const rows = this.db.tables[this.table] ?? [];
    let matched = rows.filter((r) => this.matches(r));
    if (this.orderCol) {
      matched = [...matched].sort((a, b) => {
        const av = (a[this.orderCol!] as string) ?? "";
        const bv = (b[this.orderCol!] as string) ?? "";
        return this.orderDesc ? (av < bv ? 1 : -1) : av < bv ? -1 : 1;
      });
    }
    if (wantSingle) return Promise.resolve({ data: matched[0] ?? null, error: null });
    return Promise.resolve({ data: matched, error: null });
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

function seedBase(db: SupabaseClient) {
  const fake = db as unknown as FakeDb;
  fake.tables.contracts = [
    { id: "contract-1", template_id: "tpl-1", billing_requirement: { type: "none" } },
  ];
  fake.tables.tenant_contract_acceptances = [];
  fake.tables.contract_document_requirements = [];
  fake.tables.contract_documents = [];
  fake.tables.invoices = [];
}

describe("OperationContractGate.check", () => {
  let db: SupabaseClient;

  beforeEach(() => {
    db = makeDb();
    seedBase(db);
  });

  it("is not blocked when the operation has no contract at all", async () => {
    const result = await OperationContractGate.check(db, { contractId: null });
    expect(result.blocked).toBe(false);
  });

  it("blocks when the contract has no customer acceptance yet", async () => {
    const result = await OperationContractGate.check(db, { contractId: "contract-1" });
    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain("contract_not_accepted");
  });

  it("releases once accepted, no mandatory documents, and no billing requirement", async () => {
    const fake = db as unknown as FakeDb;
    fake.tables.tenant_contract_acceptances.push({
      contract_id: "contract-1",
      party_type: "customer",
      customer_id: "cust-1",
    });

    const result = await OperationContractGate.check(db, { contractId: "contract-1" });
    expect(result.blocked).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("blocks on unapproved mandatory documents even after acceptance", async () => {
    const fake = db as unknown as FakeDb;
    fake.tables.tenant_contract_acceptances.push({
      contract_id: "contract-1",
      party_type: "customer",
      customer_id: "cust-1",
    });
    fake.tables.contract_document_requirements.push({
      id: "req-cnh",
      template_id: "tpl-1",
      key: "cnh",
      is_mandatory: true,
    });

    const result = await OperationContractGate.check(db, { contractId: "contract-1" });
    expect(result.blocked).toBe(true);
    expect(result.reasons).toContain("required_documents_not_approved");
  });

  it("blocks on an unpaid billing requirement, releases once paid", async () => {
    const fake = db as unknown as FakeDb;
    fake.tables.contracts[0].billing_requirement = { type: "deposit", amount_cents: 50000 };
    fake.tables.tenant_contract_acceptances.push({
      contract_id: "contract-1",
      party_type: "customer",
      customer_id: "cust-1",
    });

    const blocked = await OperationContractGate.check(db, { contractId: "contract-1" });
    expect(blocked.blocked).toBe(true);
    expect(blocked.reasons).toContain("billing_requirement_not_satisfied");

    fake.tables.invoices.push({
      contract_id: "contract-1",
      paid_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    const released = await OperationContractGate.check(db, { contractId: "contract-1" });
    expect(released.blocked).toBe(false);
  });

  it("never blocks on missing operator acceptance — operators are record-keeping only", async () => {
    const fake = db as unknown as FakeDb;
    fake.tables.tenant_contract_acceptances.push({
      contract_id: "contract-1",
      party_type: "customer",
      customer_id: "cust-1",
    });
    // No operator acceptance recorded anywhere, and the gate never queries
    // for one — this test documents that fact explicitly.
    const result = await OperationContractGate.check(db, { contractId: "contract-1" });
    expect(result.blocked).toBe(false);
  });
});
