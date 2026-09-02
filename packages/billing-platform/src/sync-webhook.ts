import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type {
  NormalizedBillingEvent,
  SubscriptionProduct,
  SubscriptionStatus,
  SyncWebhookResult,
} from "./types.js";

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

// Fase B (Stripe -> Asaas migration): the DB-writing core, gateway-
// agnostic. Every field it reads comes off NormalizedBillingEvent, never
// a raw Stripe/Asaas payload directly -- each provider's own mapper
// (mapStripeEventToNormalized below, AsaasBillingProvider's own mapper)
// is where gateway-specific parsing happens.
//
// Idempotency: the event is logged into platform_billing_events FIRST,
// under a unique index on the gateway event id column -- a duplicate-key
// error (23505) means this event was already processed (gateways retry
// webhooks), so processing is skipped. Unchanged behavior from before
// this refactor, same column (gateway_event_id, generic text -- Fase D
// renames it, not this phase, per the migration plan's own sequencing).
export async function applyBillingEvent(
  db: SupabaseClient,
  event: NormalizedBillingEvent,
): Promise<SyncWebhookResult> {
  const { data: logged, error: logError } = await db
    .from("platform_billing_events")
    .insert({
      provider: event.provider,
      event_type: event.eventType,
      gateway_event_id: event.gatewayEventId,
      payload: event.rawPayload,
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

  switch (event.kind) {
    case "checkout_completed": {
      if (!event.authUserId) break; // pre-identity checkout session — nothing to link

      const product = event.product ?? "mkt";
      const planKey = event.planKey ?? "unknown";

      const { data: customer, error: customerError } = await db
        .from("platform_customers")
        .upsert(
          {
            auth_user_id: event.authUserId,
            email: event.email ?? null,
            gateway_customer_id: event.gatewayCustomerId ?? null,
          },
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
            gateway_subscription_id: event.gatewaySubscriptionId ?? null,
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
            gateway_subscription_id: event.gatewaySubscriptionId ?? null,
          })
          .select("id")
          .single();
        if (error || !created) throw new Error(`subscription insert failed: ${error?.message}`);
        subscriptionId = created.id;
      }
      handled = true;
      break;
    }

    case "subscription_updated": {
      const { data: updated, error } = await db
        .from("platform_subscriptions")
        .update({
          status: event.status ?? "pending",
          current_period_start: event.currentPeriodStart ?? null,
          current_period_end: event.currentPeriodEnd ?? null,
          cancel_at_period_end: event.cancelAtPeriodEnd ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq("gateway_subscription_id", event.gatewaySubscriptionId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`subscription update failed: ${error.message}`);
      subscriptionId = updated?.id;
      handled = true;
      break;
    }

    case "subscription_cancelled": {
      const { data: cancelled, error } = await db
        .from("platform_subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("gateway_subscription_id", event.gatewaySubscriptionId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`subscription cancel failed: ${error.message}`);
      subscriptionId = cancelled?.id;
      handled = true;
      break;
    }

    case null:
    default:
      break;
  }

  await db
    .from("platform_billing_events")
    .update({ processed_at: new Date().toISOString(), subscription_id: subscriptionId ?? null })
    .eq("id", logged.id);

  return { duplicate: false, handled, subscriptionId };
}

// Maps a verified Stripe.Event into the normalized shape -- this is
// exactly the field-extraction logic that used to live directly inside
// the old syncStripeEvent(), unchanged in behavior, just relocated so
// applyBillingEvent() above never needs to know about the Stripe SDK's
// types.
export function mapStripeEventToNormalized(
  event: Stripe.Event,
  options?: { defaultProduct?: SubscriptionProduct },
): NormalizedBillingEvent {
  const base = {
    provider: "stripe" as const,
    gatewayEventId: event.id,
    eventType: event.type,
    rawPayload: event.data.object as unknown as Record<string, unknown>,
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const authUserId = session.client_reference_id;
      const email = session.customer_details?.email ?? session.customer_email ?? null;
      const product = (session.metadata?.product ??
        options?.defaultProduct ??
        "mkt") as SubscriptionProduct;
      const planKey = session.metadata?.plan ?? "unknown";
      const gatewayCustomerId =
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
      const gatewaySubscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);
      return {
        ...base,
        kind: authUserId ? "checkout_completed" : null,
        authUserId,
        email,
        product,
        planKey,
        gatewayCustomerId,
        gatewaySubscriptionId,
        checkoutRefId: session.metadata?.checkout_ref_id ?? null,
      };
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      return {
        ...base,
        kind: "subscription_updated",
        gatewaySubscriptionId: subscription.id,
        status: mapStripeStatus(subscription.status),
        currentPeriodStart: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      return { ...base, kind: "subscription_cancelled", gatewaySubscriptionId: subscription.id };
    }

    default:
      return { ...base, kind: null };
  }
}

export async function syncStripeEvent(
  db: SupabaseClient,
  event: Stripe.Event,
  options?: { defaultProduct?: SubscriptionProduct },
): Promise<SyncWebhookResult> {
  return applyBillingEvent(db, mapStripeEventToNormalized(event, options));
}
