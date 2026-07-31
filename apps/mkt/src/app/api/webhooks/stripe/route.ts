import { NextResponse } from "next/server";
import { syncStripeEvent } from "@shina/billing-platform";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

// Webhook do Stripe. Toda liberação de acesso acontece AQUI (nunca na
// página de sucesso do checkout): syncStripeEvent processa o evento de
// forma idempotente (platform_billing_events.stripe_event_id) e cria/
// atualiza platform_customers + platform_subscriptions vinculados ao
// auth_user_id que /api/checkout colocou em client_reference_id.
//
// customer.subscription.deleted mantém, além da sincronização, a garantia
// de reembolso em 14 dias (metadados da assinatura, ver /api/checkout).
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

  // Provisionamento/sincronização de assinatura (idempotente).
  const admin = createAdminClient();
  try {
    const sync = await syncStripeEvent(admin, event, { defaultProduct: "mkt" });
    if (sync.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    console.error("[stripe webhook] sync failed:", err);
    // 500 força o Stripe a reenviar o evento — melhor do que perder o
    // provisionamento silenciosamente.
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }

  // Garantia de reembolso em 14 dias — lógica preservada como estava.
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const refundEligibleUntil = Number(subscription.metadata.refundEligibleUntil ?? 0);

    if (refundEligibleUntil && Date.now() <= refundEligibleUntil) {
      const invoices = await stripe.invoices.list({
        subscription: subscription.id,
        limit: 1,
      });
      const lastInvoice = invoices.data[0];
      const paymentIntentId =
        typeof lastInvoice?.payment_intent === "string" ? lastInvoice.payment_intent : null;

      if (paymentIntentId) {
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
          reason: "requested_by_customer",
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
