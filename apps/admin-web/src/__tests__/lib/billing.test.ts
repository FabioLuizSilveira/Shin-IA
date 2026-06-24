import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatCurrency,
  computeInvoiceTotal,
  isOverdue,
  computeOutstandingBalance,
  groupInvoicesByStatus,
} from "../../lib/billing.js";
import type { Invoice } from "../../lib/types.js";

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv1",
    tenantId: "t1",
    status: "issued",
    total: 1000,
    paid: 0,
    dueDate: "2099-12-31",
    items: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("formatCurrency", () => {
  it("formats positive amount", () => {
    const result = formatCurrency(1500, "BRL");
    expect(result).toContain("1");
    expect(result).toContain("500");
  });

  it("formats negative amount with parentheses", () => {
    const result = formatCurrency(-100, "BRL");
    expect(result).toMatch(/\(/);
    expect(result).toMatch(/\)/);
  });

  it("formats zero", () => {
    const result = formatCurrency(0, "USD");
    expect(typeof result).toBe("string");
  });
});

describe("computeInvoiceTotal", () => {
  it("returns 0 for empty items", () => {
    expect(computeInvoiceTotal([])).toBe(0);
  });

  it("computes total without discount", () => {
    const total = computeInvoiceTotal([
      { description: "A", quantity: 2, unitPrice: 100, discount: 0 },
    ]);
    expect(total).toBe(200);
  });

  it("applies discount", () => {
    const total = computeInvoiceTotal([
      { description: "A", quantity: 2, unitPrice: 100, discount: 0.1 },
    ]);
    expect(total).toBeCloseTo(180);
  });

  it("sums multiple items", () => {
    const total = computeInvoiceTotal([
      { description: "A", quantity: 1, unitPrice: 100, discount: 0 },
      { description: "B", quantity: 3, unitPrice: 50, discount: 0 },
    ]);
    expect(total).toBe(250);
  });
});

describe("isOverdue", () => {
  it("returns true for past due date", () => {
    expect(isOverdue("2020-01-01")).toBe(true);
  });

  it("returns false for future due date", () => {
    expect(isOverdue("2099-12-31")).toBe(false);
  });
});

describe("computeOutstandingBalance", () => {
  it("returns 0 for no invoices", () => {
    expect(computeOutstandingBalance([])).toBe(0);
  });

  it("sums outstanding amounts", () => {
    const invoices = [
      makeInvoice({ total: 1000, paid: 300 }),
      makeInvoice({ id: "inv2", total: 500, paid: 500 }),
    ];
    expect(computeOutstandingBalance(invoices)).toBe(700);
  });

  it("handles fully paid invoice", () => {
    const invoices = [makeInvoice({ total: 200, paid: 200 })];
    expect(computeOutstandingBalance(invoices)).toBe(0);
  });
});

describe("groupInvoicesByStatus", () => {
  it("returns empty arrays for no invoices", () => {
    const groups = groupInvoicesByStatus([]);
    expect(groups.draft).toHaveLength(0);
    expect(groups.issued).toHaveLength(0);
    expect(groups.paid).toHaveLength(0);
    expect(groups.overdue).toHaveLength(0);
  });

  it("groups by status", () => {
    const invoices = [
      makeInvoice({ status: "paid" }),
      makeInvoice({ id: "inv2", status: "draft" }),
      makeInvoice({ id: "inv3", status: "issued" }),
    ];
    const groups = groupInvoicesByStatus(invoices);
    expect(groups.paid).toHaveLength(1);
    expect(groups.draft).toHaveLength(1);
    expect(groups.issued).toHaveLength(1);
  });

  it("puts overdue invoices in overdue group", () => {
    const invoices = [makeInvoice({ status: "overdue" })];
    const groups = groupInvoicesByStatus(invoices);
    expect(groups.overdue).toHaveLength(1);
  });
});
