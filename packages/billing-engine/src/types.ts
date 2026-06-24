// ─── Billing Account ──────────────────────────────────────────────────────────

export type BillingAccountStatus = "active" | "suspended" | "cancelled" | "pending";
export type BillingCycle = "monthly" | "quarterly" | "annual";
export type Currency = "BRL" | "USD" | "EUR";

export interface BillingAccount {
  id: string;
  tenantId: string;
  status: BillingAccountStatus;
  currency: Currency;
  billingCycle: BillingCycle;
  creditBalance: number;
  overdueAmount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled" | "unpaid";
export type PlanInterval = "monthly" | "quarterly" | "annual";

export interface SubscriptionPlan {
  id: string;
  name: string;
  interval: PlanInterval;
  basePrice: number;
  currency: Currency;
  features: string[];
  maxBranches: number | null;
  maxUsers: number | null;
}

export interface Subscription {
  id: string;
  billingAccountId: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd: string | null;
  cancelAt: string | null;
  cancelledAt: string | null;
  quantity: number;
  unitPrice: number;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  subscriptionId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  metadata: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  billingAccountId: string;
  tenantId: string;
  subscriptionId: string | null;
  status: InvoiceStatus;
  currency: Currency;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  dueDate: string;
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
  lines: InvoiceLine[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Revenue Share ────────────────────────────────────────────────────────────

export type RevenueShareStatus = "pending" | "calculated" | "approved" | "paid";

export interface RevenueShare {
  id: string;
  billingAccountId: string;
  tenantId: string;
  invoiceId: string;
  grossAmount: number;
  platformFeePercent: number;
  platformFeeAmount: number;
  netAmount: number;
  currency: Currency;
  status: RevenueShareStatus;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Settlement ───────────────────────────────────────────────────────────────

export type SettlementStatus = "pending" | "processing" | "completed" | "failed";

export interface Settlement {
  id: string;
  billingAccountId: string;
  tenantId: string;
  revenueShareIds: string[];
  totalAmount: number;
  currency: Currency;
  status: SettlementStatus;
  scheduledAt: string;
  processedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  externalReference: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment Events ───────────────────────────────────────────────────────────

export type PaymentEventType =
  | "payment.received"
  | "payment.failed"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.voided"
  | "subscription.created"
  | "subscription.renewed"
  | "subscription.cancelled"
  | "settlement.completed"
  | "settlement.failed";

export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  billingAccountId: string;
  tenantId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

// ─── Repository interfaces ────────────────────────────────────────────────────

export interface BillingAccountRepository {
  findById(id: string): Promise<BillingAccount | null>;
  findByTenantId(tenantId: string): Promise<BillingAccount | null>;
  save(account: BillingAccount): Promise<BillingAccount>;
  update(account: BillingAccount): Promise<BillingAccount>;
}

export interface SubscriptionRepository {
  findById(id: string): Promise<Subscription | null>;
  findByBillingAccountId(billingAccountId: string): Promise<Subscription[]>;
  findActivePlan(billingAccountId: string): Promise<Subscription | null>;
  findPlanById(planId: string): Promise<SubscriptionPlan | null>;
  save(subscription: Subscription): Promise<Subscription>;
  update(subscription: Subscription): Promise<Subscription>;
}

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByBillingAccountId(billingAccountId: string): Promise<Invoice[]>;
  findOpenInvoices(billingAccountId: string): Promise<Invoice[]>;
  save(invoice: Invoice): Promise<Invoice>;
  update(invoice: Invoice): Promise<Invoice>;
}

export interface RevenueShareRepository {
  findById(id: string): Promise<RevenueShare | null>;
  findByInvoiceId(invoiceId: string): Promise<RevenueShare | null>;
  findPendingByBillingAccount(billingAccountId: string): Promise<RevenueShare[]>;
  save(revenueShare: RevenueShare): Promise<RevenueShare>;
  update(revenueShare: RevenueShare): Promise<RevenueShare>;
}

export interface SettlementRepository {
  findById(id: string): Promise<Settlement | null>;
  findByBillingAccountId(billingAccountId: string): Promise<Settlement[]>;
  save(settlement: Settlement): Promise<Settlement>;
  update(settlement: Settlement): Promise<Settlement>;
}

export interface PaymentEventRepository {
  save(event: PaymentEvent): Promise<PaymentEvent>;
  findByBillingAccountId(billingAccountId: string, limit?: number): Promise<PaymentEvent[]>;
}
