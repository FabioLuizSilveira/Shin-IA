// Shinã platform subscription billing — the bounded context where Shinã
// charges its own users/tenants (platform_customers / platform_subscriptions
// / platform_billing_events tables). NOT the AR module (billing_accounts /
// invoices — a tenant invoicing its own CRM organizations), and NOT the
// legacy @shina/billing-engine package, which models that AR context.

export type SubscriptionProduct = "platform" | "mkt";

export type SubscriptionStatus =
  | "pending"
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

export interface PlatformSubscription {
  id: string;
  customer_id: string;
  tenant_id: string | null;
  product: SubscriptionProduct;
  plan_key: string;
  status: SubscriptionStatus;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
}

export interface CreateCustomerParams {
  authUserId: string;
  email: string;
  /**
   * CPF/CNPJ — required by document-based gateways (Asaas rejects customer
   * creation without one); Stripe ignores it entirely. Optional here so the
   * Stripe provider's signature doesn't change; the Asaas provider throws
   * an explicit error rather than inventing a placeholder document when
   * this is missing.
   */
  document?: string;
}

export interface CreateCheckoutParams {
  authUserId: string;
  email: string;
  product: SubscriptionProduct;
  planKey: string;
  /** Stripe Price id — only the Stripe provider needs this. */
  priceId?: string;
  /**
   * Charge amount in cents and its billing cycle — needed by gateways with
   * no reusable "price" resource to reference by id (Asaas takes the value
   * directly on the checkout/subscription request). Sourced from
   * plan_versions.price_cents/billing_cycle by the caller.
   */
  amountCents?: number;
  billingCycle?: "monthly" | "yearly";
  /** Human-readable plan name for the gateway's own checkout line item. */
  planName?: string;
  /**
   * Customer name and CPF/CNPJ — required by gateways that prefill/create
   * the customer directly on the checkout request instead of via a
   * separate createCustomer() call (Asaas's `customerData`).
   */
  customerName?: string;
  document?: string;
  /**
   * Postal address — confirmed LIVE against the Asaas sandbox (docs
   * under-specified this) to be required for checkout creation: phone,
   * address, addressNumber, postalCode, province are all mandatory or the
   * gateway returns 422. No current signup/checkout flow in this codebase
   * collects a subscriber's address — wiring this into a real checkout
   * call needs that collected first; never pass a placeholder value here.
   */
  phone?: string;
  address?: string;
  addressNumber?: string;
  postalCode?: string;
  province?: string;
  successUrl: string;
  cancelUrl: string;
  /** Extra metadata forwarded to the gateway (e.g. refundEligibleUntil). */
  metadata?: Record<string, string>;
  /** Free trial length in days — omitted/0 means no trial (immediate charge). */
  trialPeriodDays?: number;
}

export interface CreatePortalParams {
  stripeCustomerId: string;
  returnUrl: string;
}

// Fase B of the Stripe -> Asaas migration: sync-webhook.ts's core DB-
// writing logic (applyBillingEvent) is gateway-agnostic, consuming this
// shape instead of a raw Stripe.Event. Each provider's syncWebhook() maps
// its own gateway's payload into this before calling applyBillingEvent —
// StripeBillingProvider's mapping is exactly the field-extraction logic
// that used to live directly in the old syncStripeEvent().
export type NormalizedEventKind =
  | "checkout_completed"
  | "subscription_updated"
  | "subscription_cancelled";

export interface NormalizedBillingEvent {
  provider: "stripe" | "asaas";
  gatewayEventId: string;
  eventType: string;
  /** null = an event type this layer doesn't act on (still logged for idempotency/audit). */
  kind: NormalizedEventKind | null;
  // checkout_completed
  authUserId?: string | null;
  email?: string | null;
  product?: SubscriptionProduct;
  planKey?: string;
  gatewayCustomerId?: string | null;
  gatewaySubscriptionId?: string | null;
  /** commercial-platform's reconciliation anchor — see checkout-orchestration.ts. */
  checkoutRefId?: string | null;
  // subscription_updated / subscription_cancelled
  status?: SubscriptionStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  rawPayload: Record<string, unknown>;
}

export interface SyncWebhookResult {
  /** True when the event id was already processed — nothing was changed. */
  duplicate: boolean;
  /** True when the event type is one this layer handles. */
  handled: boolean;
  subscriptionId?: string;
}

// Gateway abstraction. Only Stripe is implemented today; a MercadoPago
// provider would implement this same interface and be selected via the
// BILLING_PROVIDER env var (see createBillingProvider in index.ts).
export interface BillingProvider {
  createCustomer(params: CreateCustomerParams): Promise<{ customerId: string }>;
  createCheckout(params: CreateCheckoutParams): Promise<{ url: string }>;
  createPortal(params: CreatePortalParams): Promise<{ url: string }>;
  getSubscription(
    authUserId: string,
    product: SubscriptionProduct,
  ): Promise<PlatformSubscription | null>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  /**
   * Changes an active subscription's price in place (upgrade/downgrade) —
   * proration handled by the gateway. Does NOT write plan_key/plan_version
   * to platform_subscriptions itself; the caller updates our own DB row
   * once this resolves, same "gateway confirms, then we sync" posture as
   * cancelSubscription.
   */
  updateSubscription(
    subscriptionId: string,
    params: { priceId?: string; amountCents?: number },
  ): Promise<void>;
  /** Verifies + processes a raw webhook payload idempotently. */
  syncWebhook(rawBody: string, signature: string): Promise<SyncWebhookResult>;
}
