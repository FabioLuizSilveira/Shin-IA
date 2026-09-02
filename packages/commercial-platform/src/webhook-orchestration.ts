import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyBillingEvent,
  type NormalizedBillingEvent,
  type SyncWebhookResult,
} from "@shina/billing-platform";

// Fase B of the Stripe -> Asaas migration: activateFromWebhook() now
// consumes the gateway-agnostic NormalizedBillingEvent (billing-platform)
// instead of a Stripe-shaped WebhookEventLike. The two existing Stripe
// webhook routes (api/webhooks/stripe-commercial, apps/mkt's
// api/webhooks/stripe) already have a verified Stripe.Event and call
// mapStripeEventToNormalized() on it before reaching this function; the
// new Asaas webhook routes do the equivalent with
// mapAsaasEventToNormalized(). This function itself never touches either
// gateway's SDK/payload shape.

// Item 16: webhook is the source of truth for activation. Before letting
// applyBillingEvent() touch platform_subscriptions, validate that the
// checkout this event refers to actually has a matching
// ContractAcceptance / PlanVersion / CommercialTermsSnapshot on file.
export async function activateFromWebhook(
  db: SupabaseClient,
  event: NormalizedBillingEvent,
): Promise<SyncWebhookResult> {
  // Stripe's checkout.session.completed carries our authUserId directly
  // (client_reference_id). Asaas's SUBSCRIPTION_CREATED never does --
  // only checkoutRefId (its externalReference) -- so it has to be
  // resolved here, the one place with schema knowledge of
  // checkout_session_references. A checkout_completed event with neither
  // authUserId nor a resolvable checkoutRefId is a pre-identity/unlinked
  // session with nothing for this layer to act on -- same as before,
  // handled: false, never guessed.
  let resolvedEvent = event;
  if (event.kind === "checkout_completed" && !event.authUserId && event.checkoutRefId) {
    const { data: ref, error: refError } = await db
      .from("checkout_session_references")
      .select("user_id, product")
      .eq("id", event.checkoutRefId)
      .maybeSingle();
    if (refError) throw new Error(`checkout reference lookup failed: ${refError.message}`);
    if (ref) {
      const { data: userData } = await db.auth.admin.getUserById(ref.user_id);
      resolvedEvent = {
        ...event,
        authUserId: ref.user_id,
        email: userData?.user?.email ?? null,
        product: ref.product,
        // planKey isn't stored on checkout_session_references and Asaas's
        // mapper never sets it either -- applyBillingEvent() falls back
        // to "unknown" for it (same fallback the Stripe path has always
        // had for a session with no metadata.plan). The real plan is
        // still correctly enforced by the prerequisite validation below
        // (plan_versions must exist and be published) and gets written
        // onto the subscription row afterward via plan_version_id.
      };
    }
  }

  if (resolvedEvent.kind !== "checkout_completed" || !resolvedEvent.checkoutRefId) {
    // No commercial-platform reference to validate -- either a lifecycle
    // event (subscription_updated/cancelled) or a checkout with no
    // checkout_ref_id at all (a pre-existing flow that predates this
    // package). Pass straight through, unchanged from before this
    // refactor.
    return applyBillingEvent(db, resolvedEvent);
  }

  const { data: ref, error: refError } = await db
    .from("checkout_session_references")
    .select(
      "id, tenant_id, product, plan_version_id, commercial_terms_snapshot_id, contract_acceptance_id, status",
    )
    .eq("id", resolvedEvent.checkoutRefId)
    .maybeSingle();
  if (refError) throw new Error(`checkout reference lookup failed: ${refError.message}`);
  if (!ref) {
    console.error("[commercial-platform] webhook references unknown checkout_ref_id", {
      checkoutRefId: resolvedEvent.checkoutRefId,
    });
    return { duplicate: false, handled: false };
  }

  const [{ data: acceptance }, { data: planVersion }, { data: snapshot }] = await Promise.all([
    db.from("contract_acceptances").select("id").eq("id", ref.contract_acceptance_id).maybeSingle(),
    db.from("plan_versions").select("id, status").eq("id", ref.plan_version_id).maybeSingle(),
    db
      .from("commercial_terms_snapshots")
      .select("id")
      .eq("id", ref.commercial_terms_snapshot_id)
      .maybeSingle(),
  ]);

  if (!acceptance || !planVersion || !snapshot) {
    console.error("[commercial-platform] webhook activation blocked — missing prerequisite", {
      checkoutRefId: resolvedEvent.checkoutRefId,
      hasAcceptance: !!acceptance,
      hasPlanVersion: !!planVersion,
      hasSnapshot: !!snapshot,
    });
    return { duplicate: false, handled: false };
  }

  const result = await applyBillingEvent(db, {
    ...resolvedEvent,
    product: resolvedEvent.product ?? ref.product,
  });

  if (result.handled && result.subscriptionId) {
    // tenant_id belongs here, not in applyBillingEvent(): billing-platform's
    // checkout_completed handler (both its insert and update branches) never
    // sets it -- the insert branch in particular has no tenant context to
    // draw from (NormalizedBillingEvent carries no tenantId field). In the
    // common case this is masked by provisionPlatformSubscription() already
    // creating the row with tenant_id at onboarding time (the webhook then
    // only ever updates it, preserving the value untouched) -- but a churned
    // tenant reactivating (their old row is 'cancelled', excluded by
    // applyBillingEvent's existing-row lookup) hits the insert branch again
    // and would otherwise end up with a tenant_id: null row, invisible to
    // /api/commercial/subscription, /api/commercial/plan-change and
    // /api/commercial/portal (all filter by tenant_id). Live-caught during
    // Fase B's real webhook E2E verification against the Asaas sandbox, not
    // introduced by it -- the same gap existed in the original Stripe-only
    // code. Stamped unconditionally here since this is the one layer with
    // real tenant knowledge (ref.tenant_id, resolved from
    // checkout_session_references); null for mkt product, as intended.
    await db
      .from("platform_subscriptions")
      .update({
        tenant_id: ref.tenant_id,
        plan_version_id: ref.plan_version_id,
        commercial_terms_snapshot_id: ref.commercial_terms_snapshot_id,
      })
      .eq("id", result.subscriptionId);
    await db
      .from("checkout_session_references")
      .update({
        status: "completed",
        provider_session_id: resolvedEvent.gatewaySubscriptionId ?? null,
      })
      .eq("id", ref.id);
  }

  return result;
}
