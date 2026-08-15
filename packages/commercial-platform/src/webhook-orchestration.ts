import type { SupabaseClient } from "@supabase/supabase-js";
import {
  syncStripeEvent,
  type SubscriptionProduct,
  type SyncWebhookResult,
} from "@shina/billing-platform";

// Minimal structural shape of a Stripe.Event we actually read here — kept
// loose (not importing the "stripe" package's types) so this package stays
// decoupled from the gateway, matching item 14 of the spec. A real
// Stripe.Event value satisfies this shape structurally, so callers can pass
// one straight through with no cast.
export interface WebhookEventLike {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      metadata?: Record<string, string> | null;
    };
  };
}

// Item 16: webhook is the source of truth for activation. Before letting the
// existing, already-tested syncStripeEvent() touch platform_subscriptions,
// validate that the checkout this event refers to actually has a matching
// ContractAcceptance / PlanVersion / CommercialTermsSnapshot on file. Only
// checkout.session.completed carries our checkout_ref_id metadata — other
// event types (subscription.updated/deleted) pass straight through, since
// they're lifecycle updates on a subscription that was already validated at
// creation.
export async function activateFromWebhook(
  db: SupabaseClient,
  event: WebhookEventLike,
  options?: { defaultProduct?: SubscriptionProduct },
): Promise<SyncWebhookResult> {
  if (event.type === "checkout.session.completed") {
    const checkoutRefId = event.data.object.metadata?.checkout_ref_id;
    if (!checkoutRefId) {
      // Pre-existing checkout flows (or a stale link) with no commercial-flow
      // reference — nothing for this layer to validate, let the base sync
      // handle it as before (keeps this additive, not a breaking gate for
      // any checkout that predates this feature).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return syncStripeEvent(db, event as any, options);
    }

    const { data: ref, error: refError } = await db
      .from("checkout_session_references")
      .select(
        "id, tenant_id, product, plan_version_id, commercial_terms_snapshot_id, contract_acceptance_id, status",
      )
      .eq("id", checkoutRefId)
      .maybeSingle();
    if (refError) throw new Error(`checkout reference lookup failed: ${refError.message}`);
    if (!ref) {
      console.error("[commercial-platform] webhook references unknown checkout_ref_id", {
        checkoutRefId,
      });
      return { duplicate: false, handled: false };
    }

    const [{ data: acceptance }, { data: planVersion }, { data: snapshot }] = await Promise.all([
      db
        .from("contract_acceptances")
        .select("id")
        .eq("id", ref.contract_acceptance_id)
        .maybeSingle(),
      db.from("plan_versions").select("id, status").eq("id", ref.plan_version_id).maybeSingle(),
      db
        .from("commercial_terms_snapshots")
        .select("id")
        .eq("id", ref.commercial_terms_snapshot_id)
        .maybeSingle(),
    ]);

    if (!acceptance || !planVersion || !snapshot) {
      console.error("[commercial-platform] webhook activation blocked — missing prerequisite", {
        checkoutRefId,
        hasAcceptance: !!acceptance,
        hasPlanVersion: !!planVersion,
        hasSnapshot: !!snapshot,
      });
      return { duplicate: false, handled: false };
    }

    const result = await syncStripeEvent(
      db,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event as any,
      options ?? { defaultProduct: ref.product as SubscriptionProduct },
    );

    if (result.handled && result.subscriptionId) {
      await db
        .from("platform_subscriptions")
        .update({
          plan_version_id: ref.plan_version_id,
          commercial_terms_snapshot_id: ref.commercial_terms_snapshot_id,
        })
        .eq("id", result.subscriptionId);
      await db
        .from("checkout_session_references")
        .update({ status: "completed", provider_session_id: event.data.object.id ?? null })
        .eq("id", ref.id);
    }

    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return syncStripeEvent(db, event as any, options);
}
