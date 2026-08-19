import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";
import { stripe, isStripeConfigured } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

function paymentReturnUrl(status: "success" | "cancelled", kind: string) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? `https://app.${root}`;
  return `${base}/mobile/payment-complete?status=${status}&kind=${kind}`;
}

// "Só pagar para renovar" — same car, no calendar/availability check needed
// (it's the exact asset the customer already has), just a real Stripe
// charge for one more week at the same rate. Paying is what renews it —
// the webhook (checkout.session.completed, metadata.action === "renewal")
// extends contracts.period_ends_at, not this route — this route only ever
// creates the invoice + checkout session, same "webhook is the source of
// truth" rule already used everywhere else money changes hands in this app.
export async function POST(req: NextRequest) {
  if (!isStripeConfigured) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const contractId = body?.contractId;
  if (!contractId) {
    return NextResponse.json({ error: "contractId is required" }, { status: 400 });
  }

  const orgIds = context.organizations.map((o) => o.organizationId);
  const { data: contract, error: contractErr } = await context.db
    .from("contracts")
    .select("id, tenant_id, organization_id, status, value_amount, value_currency")
    .eq("id", contractId)
    .in("organization_id", orgIds)
    .maybeSingle();
  if (contractErr) return internalError(contractErr);
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status !== "active") {
    return NextResponse.json({ error: "Only active contracts can be renewed" }, { status: 422 });
  }

  let { data: billingAccount } = await context.db
    .from("billing_accounts")
    .select("id, stripe_customer_id")
    .eq("organization_id", contract.organization_id)
    .eq("tenant_id", contract.tenant_id)
    .maybeSingle();
  if (!billingAccount) {
    const { data: created, error: baErr } = await context.db
      .from("billing_accounts")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: contract.tenant_id,
        organization_id: contract.organization_id,
        cycle: "one_time",
        status: "active",
        credit_limit_amount: 5000,
        credit_limit_currency: contract.value_currency,
        balance_amount: 0,
        balance_currency: contract.value_currency,
      })
      .select("id, stripe_customer_id")
      .single();
    if (baErr) return internalError(baErr);
    billingAccount = created;
  }

  const { data: invoice, error: invErr } = await context.db
    .from("invoices")
    .insert({
      id: crypto.randomUUID(),
      tenant_id: contract.tenant_id,
      billing_account_id: billingAccount.id,
      status: "issued",
      total_amount: contract.value_amount,
      total_currency: contract.value_currency,
      due_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (invErr) return internalError(invErr);

  await context.db.from("invoice_line_items").insert({
    id: crypto.randomUUID(),
    invoice_id: invoice.id,
    tenant_id: contract.tenant_id,
    description: "Renovação semanal",
    quantity: 1,
    unit_price_amount: contract.value_amount,
    unit_price_currency: contract.value_currency,
    sort_order: 0,
  });

  let customerId = billingAccount.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: context.email ?? undefined,
      metadata: { billing_account_id: billingAccount.id },
    });
    customerId = customer.id;
    await context.db
      .from("billing_accounts")
      .update({ stripe_customer_id: customerId })
      .eq("id", billingAccount.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    payment_method_types: ["card", "pix"],
    line_items: [
      {
        price_data: {
          currency: contract.value_currency.toLowerCase(),
          product_data: { name: "Renovação de locação — 1 semana" },
          unit_amount: Math.round(Number(contract.value_amount) * 100),
        },
        quantity: 1,
      },
    ],
    success_url: paymentReturnUrl("success", "renewal"),
    cancel_url: paymentReturnUrl("cancelled", "renewal"),
    metadata: { invoice_id: invoice.id, action: "renewal", contract_id: contract.id },
  });

  await context.db
    .from("invoices")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", invoice.id);

  return NextResponse.json({ data: { url: session.url } });
}
