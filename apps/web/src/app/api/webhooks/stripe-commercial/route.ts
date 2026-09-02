import { NextResponse } from "next/server";
import { activateFromWebhook } from "@shina/commercial-platform";
import { mapStripeEventToNormalized } from "@shina/billing-platform";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-log";
import type Stripe from "stripe";

// Dedicated webhook for the Unified Commercial Flow's "platform" product —
// deliberately a NEW route, not a reuse of api/webhooks/stripe/route.ts
// (that one is the unrelated AR/invoices module — billing_accounts/invoices
// — that just happens to also be named "stripe"; do not merge them).
//
// Same posture as apps/mkt's webhook: access is only ever granted here, via
// activateFromWebhook (which validates the ContractAcceptance/PlanVersion/
// CommercialTermsSnapshot for this checkout before delegating to the
// already-tested syncStripeEvent for the actual platform_subscriptions
// write) — never by the onboarding success page redirect.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assinatura inválida.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();
  const normalized = mapStripeEventToNormalized(event, { defaultProduct: "platform" });
  try {
    const result = await activateFromWebhook(admin, normalized);
    if (result.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // applyBillingEvent (inside activateFromWebhook) writes platform_subscriptions
    // but has no notion of tenants.status — that flip is Platform-specific,
    // so it happens here, not in the shared commercial-platform package.
    if (result.handled && normalized.kind === "checkout_completed") {
      const checkoutRefId = normalized.checkoutRefId;
      if (checkoutRefId) {
        const { data: ref } = await admin
          .from("checkout_session_references")
          .select("tenant_id, user_id, plan_version_id, product")
          .eq("id", checkoutRefId)
          .maybeSingle();
        if (ref?.product === "platform" && ref.tenant_id) {
          const { data: planVersion } = await admin
            .from("plan_versions")
            .select("trial_days")
            .eq("id", ref.plan_version_id)
            .maybeSingle();
          await admin
            .from("tenants")
            .update({ status: (planVersion?.trial_days ?? 0) > 0 ? "trialing" : "active" })
            .eq("id", ref.tenant_id);
          void logActivity(admin, {
            tenantId: ref.tenant_id,
            actorId: ref.user_id,
            entityType: "subscription",
            entityId: result.subscriptionId ?? checkoutRefId,
            action: "subscription.activated",
          });
        }
      }
    }
  } catch (err) {
    console.error("[stripe-commercial webhook] sync failed:", err);
    // 500 forces Stripe to retry — losing the activation silently is worse.
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
