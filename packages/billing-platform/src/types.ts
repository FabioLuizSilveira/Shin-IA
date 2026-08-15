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
}

export interface CreateCheckoutParams {
  authUserId: string;
  email: string;
  product: SubscriptionProduct;
  planKey: string;
  priceId: string;
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
  updateSubscription(subscriptionId: string, params: { priceId: string }): Promise<void>;
  /** Verifies + processes a raw webhook payload idempotently. */
  syncWebhook(rawBody: string, signature: string): Promise<SyncWebhookResult>;
}
