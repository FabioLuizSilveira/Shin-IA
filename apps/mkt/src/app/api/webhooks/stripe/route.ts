import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import type Stripe from "stripe";

// Webhook do Stripe. Dois eventos importam para o fluxo de signup:
//
// - checkout.session.completed: pagamento confirmado → aqui é onde a conta
//   do usuário deveria ser provisionada de fato (criar/ativar o tenant no
//   Supabase). Esse projeto já tem um fluxo de onboarding em
//   apps/web/src/app/(public)/onboarding — a integração entre "pagamento
//   aprovado" e "tenant criado" fica marcada como TODO abaixo porque requer
//   decisão de produto sobre qual fluxo de provisionamento reaproveitar.
//
// - customer.subscription.deleted: assinatura cancelada → se o cancelamento
//   aconteceu dentro dos 14 dias de garantia (guardados nos metadados da
//   assinatura, ver /api/checkout), emite reembolso automático do último
//   pagamento via Stripe Refunds API.
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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // TODO(produto): provisionar o tenant/conta do usuário aqui, usando
      // session.customer / session.customer_details.email e o plano em
      // session.metadata.plan. Ver apps/web/(public)/onboarding para o
      // fluxo de criação de tenant já existente na plataforma.
      console.log("[stripe webhook] checkout completed", {
        customer: session.customer,
        plan: session.metadata?.plan,
      });
      break;
    }

    case "customer.subscription.deleted": {
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
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
