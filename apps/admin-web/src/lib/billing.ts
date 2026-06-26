import type { Invoice, InvoiceItem } from "./types.js";

export function formatCurrency(amount: number, currency: string = "BRL"): string {
  if (amount < 0) {
    return `(${Math.abs(amount).toFixed(2)} ${currency})`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

export function computeInvoiceTotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => {
    const subtotal = item.quantity * item.unitPrice;
    const discount = item.discount ?? 0;
    return sum + subtotal * (1 - discount);
  }, 0);
}

export function isOverdue(dueDateIso: string): boolean {
  return new Date(dueDateIso) < new Date();
}

export function computeOutstandingBalance(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + (inv.total - inv.paid), 0);
}

export function groupInvoicesByStatus(invoices: Invoice[]): Record<Invoice["status"], Invoice[]> {
  return {
    draft: invoices.filter((i) => i.status === "draft"),
    issued: invoices.filter((i) => i.status === "issued"),
    paid: invoices.filter((i) => i.status === "paid"),
    overdue: invoices.filter((i) => i.status === "overdue"),
  };
}
