import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { SubscriptionProduct, SubscriptionStatus, SyncWebhookResult } from "./types.js";

// Stripe subscription statuses → our normalized vocabulary.
const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  unpaid: "suspended",
  paused: "suspended",
  canceled: "cancelled",
  incomplete: "pending",
  incomplete_expired: "cancelled",
};

export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  return STRIPE_STATUS_MAP[stripeStatus] ?? "pending";
}

// Processes an already-signature-verified Stripe event idempotently:
// the unique index on platform_billing_events.stripe_event_id is the guard —
// the event is logged FIRST, and a duplicate key error means this event was
// already handled (Stripe retries webhooks), so processing is skipped.
//
// Access is only ever granted here — never by a success-page redirect.
export async function syncStripeEvent(
  db: SupabaseClient,
  event: Stripe.Event,
  options?: { defaultProduct?: SubscriptionProduct },
): Promise<SyncWebhookResult> {
  const { data: logged, error: logError } = await db
    .from("platform_billing_events")
    .insert({
      provider: "stripe",
      event_type: event.type,
      stripe_event_id: event.id,
      payload: event.data.object as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (logError) {
    if (logError.code === "23505") {
      return { duplicate: true, handled: false };
    }
    throw new Error(`billing event log failed: ${logError.message}`);
  }

  let subscriptionId: string | undefined;
  let handled = false;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const authUserId = session.client_reference_id;
      if (!authUserId) break; // pre-identity checkout session — nothing to link

      const email = session.customer_details?.email ?? session.customer_email ?? null;
      const product = (session.metadata?.product ??
        options?.defaultProduct ??
        "mkt") as SubscriptionProduct;
      const planKey = session.metadata?.plan ?? "unknown";
      const stripeCustomerId =
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
      const stripeSubscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);

      const { data: customer, error: customerError } = await db
        .from("platform_customers")
        .upsert(
          { auth_user_id: authUserId, email, stripe_customer_id: stripeCustomerId },
          { onConflict: "auth_user_id" },
        )
        .select("id")
        .single();
      if (customerError || !customer) {
        throw new Error(`customer upsert failed: ${customerError?.message}`);
      }

      const { data: existing } = await db
        .from("platform_subscriptions")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("product", product)
        .neq("status", "cancelled")
        .maybeSingle();

      if (existing) {
        const { error } = await db
          .from("platform_subscriptions")
          .update({
            plan_key: planKey,
            status: "active",
            stripe_subscription_id: stripeSubscriptionId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw new Error(`subscription update failed: ${error.message}`);
        subscriptionId = existing.id;
      } else {
        const { data: created, error } = await db
          .from("platform_subscriptions")
          .insert({
            customer_id: customer.id,
            product,
            plan_key: planKey,
            status: "active",
            stripe_subscription_id: stripeSubscriptionId,
          })
          .select("id")
          .single();
        if (error || !created) throw new Error(`subscription insert failed: ${error?.message}`);
        subscriptionId = created.id;
      }
      handled = true;
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const { data: updated, error } = await db
        .from("platform_subscriptions")
        .update({
          status: mapStripeStatus(subscription.status),
          current_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`subscription update failed: ${error.message}`);
      subscriptionId = updated?.id;
      handled = true;
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const { data: cancelled, error } = await db
        .from("platform_subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`subscription cancel failed: ${error.message}`);
      subscriptionId = cancelled?.id;
      handled = true;
      break;
    }

    default:
      break;
  }

  await db
    .from("platform_billing_events")
    .update({ processed_at: new Date().toISOString(), subscription_id: subscriptionId ?? null })
    .eq("id", logged.id);

  return { duplicate: false, handled, subscriptionId };
}
