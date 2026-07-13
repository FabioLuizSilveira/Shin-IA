import { NextResponse } from "next/server";
import { stripe, isStripeConfigured, PLAN_PRICE_ENV } from "@/lib/stripe/client";

// Cria uma sessão de Checkout do Stripe em modo assinatura. Cobrança
// imediata (sem trial nativo do Stripe) — a garantia de reembolso em 14
// dias é tratada no webhook (ver /api/webhooks/stripe), não como um trial
// period, porque o cliente já entra com o cartão cobrado desde o dia 1.
export async function POST(request: Request) {
  if (!isStripeConfigured) {
    return NextResponse.json(
      { error: "Pagamentos ainda não configurados (STRIPE_SECRET_KEY ausente)." },
      { status: 503 },
    );
  }

  const { plan } = (await request.json()) as { plan?: string };

  if (!plan || !(plan in PLAN_PRICE_ENV)) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const priceId = PLAN_PRICE_ENV[plan];
  if (!priceId) {
    return NextResponse.json(
      {
        error: `Price ID do plano "${plan}" não configurado (STRIPE_PRICE_${plan.toUpperCase()}).`,
      },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_MKT_URL ?? "http://localhost:3003";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/signup?plan=${plan}`,
    subscription_data: {
      metadata: { plan, refundEligibleUntil: String(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    },
    metadata: { plan },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
