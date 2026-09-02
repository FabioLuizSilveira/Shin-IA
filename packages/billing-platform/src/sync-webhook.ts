import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedBillingEvent, SyncWebhookResult } from "./types.js";

// Gateway-agnostic DB-writing core (Fase B of the Stripe -> Asaas
// migration). Every field it reads comes off NormalizedBillingEvent, never
// a raw gateway payload directly -- each provider's own mapper (formerly
// mapStripeEventToNormalized here, now AsaasBillingProvider's
// mapAsaasEventToNormalized, the only one left after Fase F removed Stripe)
// is where gateway-specific parsing happens.
//
// Idempotency: the event is logged into platform_billing_events FIRST,
// under a unique index on the gateway event id column -- a duplicate-key
// error (23505) means this event was already processed (gateways retry
// webhooks), so processing is skipped.
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
