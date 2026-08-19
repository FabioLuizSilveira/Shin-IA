import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";
import { stripe, isStripeConfigured } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";

const DEPOSIT_RATIO = 0.2;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function paymentReturnUrl(status: "success" | "cancelled", kind: string) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
  const base = process.env.NEXT_PUBLIC_APP_URL ?? `https://app.${root}`;
  return `${base}/mobile/payment-complete?status=${status}&kind=${kind}`;
}

// "Se o cliente opta por outro carro" — a real booking: pick dates, pay a
// 20% deposit now to hold the period. This route creates the reservation +
// deposit invoice + Stripe session; the deposit only actually counts once
// the webhook confirms payment (metadata.action === "deposit"). The DB's
// own exclusion constraint (rental_reservations_no_overlap) is the real
// guard against double-booking — this route's own overlap check is just a
// friendlier 409 before that constraint would reject the insert anyway.
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
  const assetId = body?.assetId as string | undefined;
  const startsAt = body?.startsAt as string | undefined;
  const endsAt = body?.endsAt as string | undefined;
  if (!assetId || !startsAt || !endsAt) {
    return NextResponse.json(
      { error: "assetId, startsAt and endsAt are required" },
      { status: 400 },
    );
  }
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (!(start < end)) {
    return NextResponse.json({ error: "startsAt must be before endsAt" }, { status: 422 });
  }

  const { data: asset, error: assetErr } = await context.db
    .from("assets")
    .select("id, name, tenant_id, status, metadata")
    .eq("id", assetId)
    .eq("status", "available")
    .maybeSingle();
  if (assetErr) return internalError(assetErr);
  if (!asset) return NextResponse.json({ error: "Asset not available" }, { status: 404 });

  const tenantOrg = context.organizations.find((o) => o.tenantId === asset.tenant_id);
  if (!tenantOrg) {
    return NextResponse.json({ error: "Not a customer of this tenant" }, { status: 403 });
  }

  const { data: overlap } = await context.db
    .from("rental_reservations")
    .select("id")
    .eq("asset_id", assetId)
    .in("status", ["pending_deposit", "reserved"])
    .lt("period_starts_at", endsAt)
    .gt("period_ends_at", startsAt)
    .limit(1);
  if (overlap && overlap.length > 0) {
    return NextResponse.json({ error: "Period no longer available" }, { status: 409 });
  }

  const weeklyRate = Number((asset.metadata as Record<string, unknown>)?.weekly_rate ?? 0);
  const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_WEEK));
  const total = Math.round(weeklyRate * weeks * 100) / 100;
  const deposit = Math.round(total * DEPOSIT_RATIO * 100) / 100;
  const balance = Math.round((total - deposit) * 100) / 100;
  const currency = "BRL";

  const { data: reservation, error: resErr } = await context.db
    .from("rental_reservations")
    .insert({
      tenant_id: asset.tenant_id,
      rental_customer_id: context.customerId,
      organization_id: tenantOrg.organizationId,
      asset_id: assetId,
      period_starts_at: startsAt,
      period_ends_at: endsAt,
      total_amount: total,
      total_currency: currency,
      deposit_amount: deposit,
      balance_amount: balance,
      status: "pending_deposit",
    })
    .select("id")
    .single();
  if (resErr) {
    // Exclusion constraint violation surfaces here if the friendlier check
    // above raced with another booking.
    return NextResponse.json({ error: "Period no longer available" }, { status: 409 });
  }

  let { data: billingAccount } = await context.db
    .from("billing_accounts")
    .select("id, stripe_customer_id")
    .eq("organization_id", tenantOrg.organizationId)
    .eq("tenant_id", asset.tenant_id)
    .maybeSingle();
  if (!billingAccount) {
    const { data: created, error: baErr } = await context.db
      .from("billing_accounts")
      .insert({
        tenant_id: asset.tenant_id,
        organization_id: tenantOrg.organizationId,
        cycle: "one_time",
        status: "active",
        credit_limit_amount: 5000,
        credit_limit_currency: currency,
        balance_amount: 0,
        balance_currency: currency,
      })
      .select("id, stripe_customer_id")
      .single();
    if (baErr) return internalError(baErr);
    billingAccount = created;
  }

  const { data: invoice, error: invErr } = await context.db
    .from("invoices")
    .insert({
      tenant_id: asset.tenant_id,
      billing_account_id: billingAccount.id,
      status: "issued",
      total_amount: deposit,
      total_currency: currency,
      due_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (invErr) return internalError(invErr);

  await context.db.from("invoice_line_items").insert({
    invoice_id: invoice.id,
    tenant_id: asset.tenant_id,
    description: `Sinal (20%) — ${asset.name}`,
    quantity: 1,
    unit_price_amount: deposit,
    unit_price_currency: currency,
    sort_order: 0,
  });

  await context.db
    .from("rental_reservations")
    .update({ deposit_invoice_id: invoice.id })
    .eq("id", reservation.id);

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
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: `Sinal (20%) — ${asset.name}` },
          unit_amount: Math.round(deposit * 100),
        },
        quantity: 1,
      },
    ],
    success_url: paymentReturnUrl("success", "deposit"),
    cancel_url: paymentReturnUrl("cancelled", "deposit"),
    metadata: { invoice_id: invoice.id, action: "deposit", reservation_id: reservation.id },
  });

  await context.db
    .from("invoices")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", invoice.id);

  return NextResponse.json({
    data: { url: session.url, reservationId: reservation.id, deposit, balance, total },
  });
}
