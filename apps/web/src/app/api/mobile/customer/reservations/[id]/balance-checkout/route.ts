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

// The 80% balance — only payable once the deposit is actually confirmed
// paid (status === "reserved"). Paying this is what the webhook
// (metadata.action === "balance") turns into the real contract; the cron
// job (api/cron/forfeit-reservations) is what happens if this never gets
// paid by period_starts_at - 1 day.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const { data: reservation, error: resErr } = await context.db
    .from("rental_reservations")
    .select(
      "id, tenant_id, organization_id, asset_id, balance_amount, balance_invoice_id, status, assets(name)",
    )
    .eq("id", id)
    .eq("rental_customer_id", context.customerId)
    .maybeSingle();
  if (resErr) return internalError(resErr);
  if (!reservation) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (reservation.status !== "reserved") {
    return NextResponse.json(
      { error: "Balance can only be paid after the deposit is confirmed" },
      { status: 422 },
    );
  }

  const { data: billingAccount } = await context.db
    .from("billing_accounts")
    .select("id, stripe_customer_id")
    .eq("organization_id", reservation.organization_id)
    .eq("tenant_id", reservation.tenant_id)
    .maybeSingle();
  if (!billingAccount) {
    return NextResponse.json({ error: "Billing account not found" }, { status: 500 });
  }

  const assetName = (reservation.assets as unknown as { name: string } | null)?.name ?? "veículo";
  const currency = "BRL";

  let invoiceId = reservation.balance_invoice_id;
  if (!invoiceId) {
    const { data: invoice, error: invErr } = await context.db
      .from("invoices")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: reservation.tenant_id,
        billing_account_id: billingAccount.id,
        status: "issued",
        total_amount: reservation.balance_amount,
        total_currency: currency,
        due_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (invErr) return internalError(invErr);
    invoiceId = invoice.id;

    await context.db.from("invoice_line_items").insert({
      id: crypto.randomUUID(),
      invoice_id: invoiceId,
      tenant_id: reservation.tenant_id,
      description: `Saldo (80%) — ${assetName}`,
      quantity: 1,
      unit_price_amount: reservation.balance_amount,
      unit_price_currency: currency,
      sort_order: 0,
    });

    await context.db
      .from("rental_reservations")
      .update({ balance_invoice_id: invoiceId })
      .eq("id", reservation.id);
  }

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
          currency: currency.toLowerCase(),
          product_data: { name: `Saldo (80%) — ${assetName}` },
          unit_amount: Math.round(Number(reservation.balance_amount) * 100),
        },
        quantity: 1,
      },
    ],
    success_url: paymentReturnUrl("success", "balance"),
    cancel_url: paymentReturnUrl("cancelled", "balance"),
    metadata: { invoice_id: invoiceId, action: "balance", reservation_id: reservation.id },
  });

  await context.db
    .from("invoices")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", invoiceId);

  return NextResponse.json({ data: { url: session.url } });
}
