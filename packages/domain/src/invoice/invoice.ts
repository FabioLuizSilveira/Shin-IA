import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import { Money } from "../shared/value-objects/money.js";
import type { TenantId } from "../tenant/tenant.js";
import type { BillingAccountId } from "../billing-account/billing-account.js";
import { InvoiceStatus } from "./invoice-status.enum.js";
import { createEvent } from "../shared/create-event.js";

export type InvoiceId = string & { readonly __brand: "InvoiceId" };

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: Money;
}

export interface CreateInvoiceProps {
  id: InvoiceId;
  tenantId: TenantId;
  billingAccountId: BillingAccountId;
  lineItems: InvoiceLineItem[];
  dueDate: Date;
}

interface InvoiceState {
  tenantId: TenantId;
  billingAccountId: BillingAccountId;
  lineItems: InvoiceLineItem[];
  total: Money;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function computeTotal(lineItems: InvoiceLineItem[]): Money {
  if (lineItems.length === 0)
    throw new DomainError("INVOICE_NO_ITEMS", "Invoice must have at least one line item.");
  const first = lineItems[0]!;
  const base = first.unitPrice.multiply(first.quantity);
  return lineItems
    .slice(1)
    .reduce((acc, item) => acc.add(item.unitPrice.multiply(item.quantity)), base);
}

export class Invoice extends AggregateRoot<InvoiceId> {
  private _state: InvoiceState;

  private constructor(id: InvoiceId, state: InvoiceState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateInvoiceProps): Invoice {
    const total = computeTotal(props.lineItems);
    const now = new Date();
    const invoice = new Invoice(props.id, {
      ...props,
      total,
      status: InvoiceStatus.Draft,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    });

    invoice.raise(
      createEvent("invoice.created", props.id, "Invoice", props.tenantId, {
        billingAccountId: props.billingAccountId,
        total: total.amount,
        currency: total.currency,
      }),
    );

    return invoice;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get billingAccountId(): BillingAccountId {
    return this._state.billingAccountId;
  }
  get lineItems(): InvoiceLineItem[] {
    return this._state.lineItems;
  }
  get total(): Money {
    return this._state.total;
  }
  get status(): InvoiceStatus {
    return this._state.status;
  }
  get dueDate(): Date {
    return this._state.dueDate;
  }
  get paidAt(): Date | null {
    return this._state.paidAt;
  }

  issue(): void {
    if (this._state.status !== InvoiceStatus.Draft)
      throw new DomainError("INVOICE_NOT_DRAFT", "Only draft invoices can be issued.");
    this._state.status = InvoiceStatus.Issued;
    this._state.updatedAt = new Date();
    this.raise(createEvent("invoice.issued", this._id, "Invoice", this._state.tenantId, {}));
  }

  markPaid(): void {
    if (this._state.status !== InvoiceStatus.Issued && this._state.status !== InvoiceStatus.Overdue)
      throw new DomainError(
        "INVOICE_NOT_PAYABLE",
        "Invoice must be issued or overdue to be marked paid.",
      );
    this._state.status = InvoiceStatus.Paid;
    this._state.paidAt = new Date();
    this._state.updatedAt = new Date();
    this.raise(createEvent("invoice.paid", this._id, "Invoice", this._state.tenantId, {}));
  }

  void_(): void {
    if (this._state.status === InvoiceStatus.Paid)
      throw new DomainError("INVOICE_ALREADY_PAID", "Paid invoices cannot be voided.");
    this._state.status = InvoiceStatus.Voided;
    this._state.updatedAt = new Date();
    this.raise(createEvent("invoice.voided", this._id, "Invoice", this._state.tenantId, {}));
  }
}
