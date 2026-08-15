import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncStripeEvent } from "../sync-webhook.js";
import type {
  BillingProvider,
  CreateCheckoutParams,
  CreateCustomerParams,
  CreatePortalParams,
  PlatformSubscription,
  SubscriptionProduct,
  SyncWebhookResult,
} from "../types.js";

export interface StripeBillingProviderOptions {
  secretKey: string;
  webhookSecret?: string;
  /** Service-role Supabase client — all billing tables are service-role-only. */
  db: SupabaseClient;
}

export class StripeBillingProvider implements BillingProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret?: string;
  private readonly db: SupabaseClient;

  constructor(options: StripeBillingProviderOptions) {
    // Placeholder key keeps module construction safe when the env var is
    // absent (same pattern as apps/*/src/lib/stripe/client.ts).
    this.stripe = new Stripe(options.secretKey || "sk_not_configured", {
      apiVersion: "2025-02-24.acacia",
    });
    this.webhookSecret = options.webhookSecret;
    this.db = options.db;
  }

  async createCustomer(params: CreateCustomerParams): Promise<{ customerId: string }> {
    const { data: existing } = await this.db
      .from("platform_customers")
      .select("id, stripe_customer_id")
      .eq("auth_user_id", params.authUserId)
      .maybeSingle();

    if (existing?.stripe_customer_id) {
      return { customerId: existing.stripe_customer_id };
    }

    const stripeCustomer = await this.stripe.customers.create({
      email: params.email,
      metadata: { auth_user_id: params.authUserId },
    });

    const { error } = await this.db.from("platform_customers").upsert(
      {
        auth_user_id: params.authUserId,
        email: params.email,
        stripe_customer_id: stripeCustomer.id,
      },
      { onConflict: "auth_user_id" },
    );
    if (error) throw new Error(`customer upsert failed: ${error.message}`);

    return { customerId: stripeCustomer.id };
  }

  async createCheckout(params: CreateCheckoutParams): Promise<{ url: string }> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: params.priceId, quantity: 1 }],
      client_reference_id: params.authUserId,
      customer_email: params.email,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { product: params.product, plan: params.planKey, ...params.metadata },
      subscription_data: {
        metadata: { product: params.product, plan: params.planKey, ...params.metadata },
        ...(params.trialPeriodDays ? { trial_period_days: params.trialPeriodDays } : {}),
      },
      allow_promotion_codes: true,
    });
    if (!session.url) throw new Error("Stripe returned a session without a URL");
    return { url: session.url };
  }

  async createPortal(params: CreatePortalParams): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  }

  async getSubscription(
    authUserId: string,
    product: SubscriptionProduct,
  ): Promise<PlatformSubscription | null> {
    const { data } = await this.db
      .from("platform_subscriptions")
      .select("*, platform_customers!inner(auth_user_id)")
      .eq("platform_customers.auth_user_id", authUserId)
      .eq("product", product)
      .neq("status", "cancelled")
      .maybeSingle();
    return (data as PlatformSubscription | null) ?? null;
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const { data: sub } = await this.db
      .from("platform_subscriptions")
      .select("stripe_subscription_id")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) throw new Error("Subscription has no gateway id");
    // Cancellation is finalized by the customer.subscription.deleted webhook,
    // not here — the DB status only changes when the gateway confirms.
    await this.stripe.subscriptions.cancel(sub.stripe_subscription_id);
  }

  async updateSubscription(subscriptionId: string, params: { priceId: string }): Promise<void> {
    const { data: sub } = await this.db
      .from("platform_subscriptions")
      .select("stripe_subscription_id")
      .eq("id", subscriptionId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) throw new Error("Subscription has no gateway id");

    const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) throw new Error("Stripe subscription has no items to update");

    await this.stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: params.priceId }],
      proration_behavior: "create_prorations",
    });
  }

  async syncWebhook(rawBody: string, signature: string): Promise<SyncWebhookResult> {
    if (!this.webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    return syncStripeEvent(this.db, event);
  }
}
