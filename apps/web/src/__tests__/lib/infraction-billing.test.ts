import { describe, expect, it } from "vitest";
import { ensureInfractionCharge } from "@/lib/infraction-billing";

// Fase J — permanent regression coverage for the "never automatic" gate
// (item 25 of the spec: a reimbursement charge must never be generated
// just because an infraction was received). This is the first vitest
// coverage any apps/web `lib/*.ts` billing helper has ever had (the
// Inspection Engine's equivalent, ensureFindingCharge(), was only ever
// verified live against the hosted DB, per docs/architecture/
// INSPECTION_ENGINE.md's own documented gap) — a real gap this closes,
// not just a mirror of existing coverage.
//
// A minimal fluent mock instead of a real SupabaseClient: every chain
// method (select/eq/is/not/order/limit) returns the same chain object,
// and the two terminal calls the real function uses (maybeSingle/single)
// resolve from a per-table lookup table configured per test. insert()
// returns an object that is both a valid awaited value ({error}) for the
// two "no .select() after insert" call sites (invoices, invoice_line_items)
// and chainable (.select().single()) for the one that needs the created
// row back (billing_accounts) -- exactly the three ways the real code
// calls insert().
interface MockConfig {
  existingLine?: { id: string } | null;
  payment?: { amount_paid_cents: number | null } | null;
  contract?: { id: string; organization_id: string | null } | null;
  billingAccount?: { id: string } | null;
  invoiceInsertError?: { message: string } | null;
}

function createMockDb(config: MockConfig = {}) {
  const inserts: Record<string, unknown[]> = {
    billing_accounts: [],
    invoices: [],
    invoice_line_items: [],
  };

  function terminalFor(table: string) {
    switch (table) {
      case "invoice_line_items":
        return config.existingLine ?? null;
      case "infraction_payments":
        return config.payment ?? null;
      case "contracts":
        return config.contract ?? null;
      case "billing_accounts":
        return config.billingAccount ?? null;
      default:
        return null;
    }
  }

  function builder(table: string) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      not: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: terminalFor(table) }),
      single: async () => ({ data: { id: "new-billing-account-id" } }),
      insert: (row: unknown) => {
        inserts[table]?.push(row);
        return {
          error: table === "invoices" ? (config.invoiceInsertError ?? null) : null,
          select: () => chain,
        };
      },
    };
    return chain;
  }

  return {
    db: { from: builder } as unknown as Parameters<typeof ensureInfractionCharge>[0],
    inserts,
  };
}

const baseCase = {
  id: "case-1",
  tenant_id: "tenant-1",
  contract_id: "contract-1",
  responsible_party_type: "customer" as const,
  responsible_party_id: "customer-1",
  responsibility_confirmed_at: "2026-08-27T00:00:00.000Z",
};

describe("ensureInfractionCharge", () => {
  it("never charges without responsibility_confirmed_at", async () => {
    const { db, inserts } = createMockDb({
      payment: { amount_paid_cents: 15000 },
      contract: { id: "contract-1", organization_id: "org-1" },
    });
    await ensureInfractionCharge(db, { ...baseCase, responsibility_confirmed_at: null });
    expect(inserts.invoices).toHaveLength(0);
  });

  it("never charges when the responsible party is an operator, not a customer", async () => {
    const { db, inserts } = createMockDb({
      payment: { amount_paid_cents: 15000 },
      contract: { id: "contract-1", organization_id: "org-1" },
    });
    await ensureInfractionCharge(db, { ...baseCase, responsible_party_type: "operator" });
    expect(inserts.invoices).toHaveLength(0);
  });

  it("never charges without a contract linked to the case", async () => {
    const { db, inserts } = createMockDb({
      payment: { amount_paid_cents: 15000 },
      contract: { id: "contract-1", organization_id: "org-1" },
    });
    await ensureInfractionCharge(db, { ...baseCase, contract_id: null });
    expect(inserts.invoices).toHaveLength(0);
  });

  it("never charges without a to_authority payment carrying a real amount_paid_cents", async () => {
    const { db, inserts } = createMockDb({
      payment: null,
      contract: { id: "contract-1", organization_id: "org-1" },
    });
    await ensureInfractionCharge(db, baseCase);
    expect(inserts.invoices).toHaveLength(0);
  });

  it("never charges when the payment amount is zero or missing", async () => {
    const { db, inserts } = createMockDb({
      payment: { amount_paid_cents: null },
      contract: { id: "contract-1", organization_id: "org-1" },
    });
    await ensureInfractionCharge(db, baseCase);
    expect(inserts.invoices).toHaveLength(0);
  });

  it("never charges when the linked contract has no organization_id", async () => {
    const { db, inserts } = createMockDb({
      payment: { amount_paid_cents: 15000 },
      contract: { id: "contract-1", organization_id: null },
    });
    await ensureInfractionCharge(db, baseCase);
    expect(inserts.invoices).toHaveLength(0);
  });

  it("is idempotent -- never charges twice for the same case", async () => {
    const { db, inserts } = createMockDb({
      existingLine: { id: "already-charged" },
      payment: { amount_paid_cents: 15000 },
      contract: { id: "contract-1", organization_id: "org-1" },
    });
    await ensureInfractionCharge(db, baseCase);
    expect(inserts.invoices).toHaveLength(0);
  });

  it("charges exactly once, for the real paid amount, when every condition holds", async () => {
    const { db, inserts } = createMockDb({
      payment: { amount_paid_cents: 15000 },
      contract: { id: "contract-1", organization_id: "org-1" },
      billingAccount: { id: "existing-account" },
    });
    await ensureInfractionCharge(db, baseCase);
    expect(inserts.invoices).toHaveLength(1);
    expect(inserts.invoices[0]).toMatchObject({ total_amount: 150, contract_id: "contract-1" });
    expect(inserts.invoice_line_items).toHaveLength(1);
    expect(inserts.invoice_line_items[0]).toMatchObject({
      infraction_case_id: "case-1",
      unit_price_amount: 150,
    });
  });

  it("creates a billing_account when none exists yet, then still charges once", async () => {
    const { db, inserts } = createMockDb({
      payment: { amount_paid_cents: 15000 },
      contract: { id: "contract-1", organization_id: "org-1" },
      billingAccount: null,
    });
    await ensureInfractionCharge(db, baseCase);
    expect(inserts.billing_accounts).toHaveLength(1);
    expect(inserts.invoices).toHaveLength(1);
  });

  it("never writes a line item if the invoice insert itself fails", async () => {
    const { db, inserts } = createMockDb({
      payment: { amount_paid_cents: 15000 },
      contract: { id: "contract-1", organization_id: "org-1" },
      billingAccount: { id: "existing-account" },
      invoiceInsertError: { message: "constraint violation" },
    });
    await ensureInfractionCharge(db, baseCase);
    expect(inserts.invoices).toHaveLength(1);
    expect(inserts.invoice_line_items).toHaveLength(0);
  });
});
