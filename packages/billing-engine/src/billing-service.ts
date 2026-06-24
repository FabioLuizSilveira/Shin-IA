import type {
  BillingAccount,
  BillingAccountRepository,
  BillingCycle,
  Currency,
  Invoice,
  InvoiceLine,
  InvoiceRepository,
  InvoiceStatus,
  PaymentEvent,
  PaymentEventRepository,
  RevenueShare,
  RevenueShareRepository,
  Subscription,
  SubscriptionRepository,
} from "./types.js";

export interface CreateBillingAccountInput {
  tenantId: string;
  currency: Currency;
  billingCycle: BillingCycle;
}

export interface CreateSubscriptionInput {
  billingAccountId: string;
  tenantId: string;
  planId: string;
  quantity?: number;
  trialDays?: number;
}

export interface CreateInvoiceInput {
  billingAccountId: string;
  tenantId: string;
  subscriptionId?: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    subscriptionId?: string;
    periodStart?: string;
    periodEnd?: string;
    metadata?: Record<string, unknown>;
  }>;
  taxRate?: number;
  metadata?: Record<string, unknown>;
}

export interface PayInvoiceInput {
  invoiceId: string;
  amount: number;
  externalReference?: string;
}

export class BillingService {
  constructor(
    private accounts: BillingAccountRepository,
    private subscriptions: SubscriptionRepository,
    private invoices: InvoiceRepository,
    private revenueShares: RevenueShareRepository,
    private events: PaymentEventRepository,
    private platformFeePercent = 15,
  ) {}

  async createBillingAccount(input: CreateBillingAccountInput): Promise<BillingAccount> {
    const existing = await this.accounts.findByTenantId(input.tenantId);
    if (existing) throw new Error(`billing account already exists for tenant ${input.tenantId}`);

    const now = new Date().toISOString();
    const account: BillingAccount = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      status: "active",
      currency: input.currency,
      billingCycle: input.billingCycle,
      creditBalance: 0,
      overdueAmount: 0,
      createdAt: now,
      updatedAt: now,
    };

    return this.accounts.save(account);
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const account = await this.accounts.findById(input.billingAccountId);
    if (!account) throw new Error(`billing account ${input.billingAccountId} not found`);
    if (account.status !== "active") throw new Error(`billing account is not active`);

    const plan = await this.subscriptions.findPlanById(input.planId);
    if (!plan) throw new Error(`plan ${input.planId} not found`);

    const now = new Date();
    const periodStart = now.toISOString();

    const trialDays = input.trialDays ?? 0;
    const trialEnd =
      trialDays > 0 ? new Date(now.getTime() + trialDays * 86400000).toISOString() : null;

    const periodEnd = this.calculatePeriodEnd(now, plan.interval);

    const subscription: Subscription = {
      id: crypto.randomUUID(),
      billingAccountId: input.billingAccountId,
      tenantId: input.tenantId,
      planId: input.planId,
      status: trialEnd ? "trialing" : "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      trialEnd,
      cancelAt: null,
      cancelledAt: null,
      quantity: input.quantity ?? 1,
      unitPrice: plan.basePrice,
      currency: plan.currency,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const saved = await this.subscriptions.save(subscription);

    await this.emitEvent({
      type: "subscription.created",
      billingAccountId: input.billingAccountId,
      tenantId: input.tenantId,
      payload: { subscriptionId: saved.id, planId: input.planId },
    });

    return saved;
  }

  async cancelSubscription(subscriptionId: string, cancelAt?: string): Promise<Subscription> {
    const sub = await this.subscriptions.findById(subscriptionId);
    if (!sub) throw new Error(`subscription ${subscriptionId} not found`);
    if (sub.status === "cancelled") throw new Error(`subscription already cancelled`);

    const now = new Date().toISOString();
    const updated: Subscription = {
      ...sub,
      status: "cancelled",
      cancelAt: cancelAt ?? now,
      cancelledAt: now,
      updatedAt: now,
    };

    const saved = await this.subscriptions.update(updated);

    await this.emitEvent({
      type: "subscription.cancelled",
      billingAccountId: sub.billingAccountId,
      tenantId: sub.tenantId,
      payload: { subscriptionId },
    });

    return saved;
  }

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const account = await this.accounts.findById(input.billingAccountId);
    if (!account) throw new Error(`billing account ${input.billingAccountId} not found`);

    const now = new Date().toISOString();
    const invoiceId = crypto.randomUUID();

    const lines: InvoiceLine[] = input.lines.map((l) => ({
      id: crypto.randomUUID(),
      invoiceId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      totalPrice: l.quantity * l.unitPrice,
      subscriptionId: l.subscriptionId ?? null,
      periodStart: l.periodStart ?? null,
      periodEnd: l.periodEnd ?? null,
      metadata: l.metadata ?? {},
    }));

    const subtotal = lines.reduce((sum, l) => sum + l.totalPrice, 0);
    const taxRate = input.taxRate ?? 0;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const total = subtotal + taxAmount;

    const invoice: Invoice = {
      id: invoiceId,
      billingAccountId: input.billingAccountId,
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId ?? null,
      status: "open",
      currency: account.currency,
      subtotal,
      taxAmount,
      total,
      amountPaid: 0,
      amountDue: total,
      dueDate: input.dueDate,
      paidAt: null,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      lines,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.invoices.save(invoice);

    await this.emitEvent({
      type: "invoice.created",
      billingAccountId: input.billingAccountId,
      tenantId: input.tenantId,
      payload: { invoiceId: saved.id, total, currency: account.currency },
    });

    // Auto-calculate revenue share when invoice is created
    await this.calculateRevenueShare(saved, account.currency);

    return saved;
  }

  async payInvoice(input: PayInvoiceInput): Promise<Invoice> {
    const invoice = await this.invoices.findById(input.invoiceId);
    if (!invoice) throw new Error(`invoice ${input.invoiceId} not found`);
    if (invoice.status === "paid") throw new Error(`invoice already paid`);
    if (invoice.status === "void") throw new Error(`invoice is voided`);
    if (input.amount < invoice.amountDue) {
      throw new Error(
        `payment amount ${input.amount} is less than amount due ${invoice.amountDue}`,
      );
    }

    const now = new Date().toISOString();
    const updated: Invoice = {
      ...invoice,
      status: "paid" as InvoiceStatus,
      amountPaid: input.amount,
      amountDue: 0,
      paidAt: now,
      updatedAt: now,
    };

    const saved = await this.invoices.update(updated);

    await this.emitEvent({
      type: "invoice.paid",
      billingAccountId: invoice.billingAccountId,
      tenantId: invoice.tenantId,
      payload: { invoiceId: invoice.id, amount: input.amount },
    });

    // Update revenue share to calculated status
    const revenueShare = await this.revenueShares.findByInvoiceId(invoice.id);
    if (revenueShare) {
      await this.revenueShares.update({
        ...revenueShare,
        status: "calculated",
        updatedAt: now,
      });
    }

    return saved;
  }

  async voidInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoices.findById(invoiceId);
    if (!invoice) throw new Error(`invoice ${invoiceId} not found`);
    if (invoice.status === "paid") throw new Error(`cannot void a paid invoice`);

    const now = new Date().toISOString();
    const updated: Invoice = {
      ...invoice,
      status: "void" as InvoiceStatus,
      amountDue: 0,
      updatedAt: now,
    };

    const saved = await this.invoices.update(updated);

    await this.emitEvent({
      type: "invoice.voided",
      billingAccountId: invoice.billingAccountId,
      tenantId: invoice.tenantId,
      payload: { invoiceId },
    });

    return saved;
  }

  async getAccountSummary(billingAccountId: string): Promise<{
    account: BillingAccount;
    activeSubscription: Subscription | null;
    openInvoices: Invoice[];
    pendingRevenueShares: RevenueShare[];
  }> {
    const account = await this.accounts.findById(billingAccountId);
    if (!account) throw new Error(`billing account ${billingAccountId} not found`);

    const [activeSubscription, openInvoices, pendingRevenueShares] = await Promise.all([
      this.subscriptions.findActivePlan(billingAccountId),
      this.invoices.findOpenInvoices(billingAccountId),
      this.revenueShares.findPendingByBillingAccount(billingAccountId),
    ]);

    return { account, activeSubscription, openInvoices, pendingRevenueShares };
  }

  private async calculateRevenueShare(invoice: Invoice, currency: string): Promise<RevenueShare> {
    const platformFeeAmount =
      Math.round(invoice.total * (this.platformFeePercent / 100) * 100) / 100;
    const netAmount = invoice.total - platformFeeAmount;
    const now = new Date().toISOString();

    const revenueShare: RevenueShare = {
      id: crypto.randomUUID(),
      billingAccountId: invoice.billingAccountId,
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      grossAmount: invoice.total,
      platformFeePercent: this.platformFeePercent,
      platformFeeAmount,
      netAmount,
      currency: currency as Currency,
      status: "pending",
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.revenueShares.save(revenueShare);
  }

  private calculatePeriodEnd(from: Date, interval: string): string {
    const d = new Date(from);
    if (interval === "monthly") d.setMonth(d.getMonth() + 1);
    else if (interval === "quarterly") d.setMonth(d.getMonth() + 3);
    else if (interval === "annual") d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  }

  private async emitEvent(input: Omit<PaymentEvent, "id" | "occurredAt">): Promise<void> {
    const event: PaymentEvent = {
      ...input,
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    };
    await this.events.save(event);
  }
}
