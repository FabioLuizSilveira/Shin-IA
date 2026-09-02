import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";
import {
  isAsaasConfigured,
  findOrCreateAsaasCustomer,
  createOneOffCharge,
  ASAAS_MIN_CHARGE_CENTS,
} from "@/lib/asaas/client";

export const dynamic = "force-dynamic";

const DEPOSIT_RATIO = 0.2;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// GET — lists the caller's own reservations. Part of the web customer
// portal's RLS→API migration (rentals-portal.ts's fetchMyReservations):
// scoped by context.customerId, never by anything client-supplied.
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await context.db
    .from("rental_reservations")
    .select(
      "id, tenant_id, asset_id, period_starts_at, period_ends_at, total_amount, total_currency, " +
        "deposit_amount, balance_amount, status, assets(name)",
    )
    .eq("rental_customer_id", context.customerId)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}

// "Se o cliente opta por outro carro" — a real booking: pick dates, pay a
// 20% deposit now to hold the period. This route creates the reservation +
// deposit invoice + Stripe session; the deposit only actually counts once
// the webhook confirms payment (metadata.action === "deposit"). The DB's
// own exclusion constraint (rental_reservations_no_overlap) is the real
// guard against double-booking — this route's own overlap check is just a
// friendlier 409 before that constraint would reject the insert anyway.
export async function POST(req: NextRequest) {
  if (!isAsaasConfigured) {
    return NextResponse.json({ error: "Asaas not configured" }, { status: 503 });
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
  const depositCents = Math.round(deposit * 100);
  if (depositCents < ASAAS_MIN_CHARGE_CENTS) {
    return NextResponse.json(
      { error: "deposit is below Asaas's minimum chargeable value (R$5,00)" },
      { status: 422 },
    );
  }

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
    .select("id, gateway_customer_id, organizations(name, email, document, phone)")
    .eq("organization_id", tenantOrg.organizationId)
    .eq("tenant_id", asset.tenant_id)
    .maybeSingle();
  if (!billingAccount) {
    const { data: created, error: baErr } = await context.db
      .from("billing_accounts")
      .insert({
        id: crypto.randomUUID(),
        tenant_id: asset.tenant_id,
        organization_id: tenantOrg.organizationId,
        cycle: "one_time",
        status: "active",
        credit_limit_amount: 5000,
        credit_limit_currency: currency,
        balance_amount: 0,
        balance_currency: currency,
      })
      .select("id, gateway_customer_id, organizations(name, email, document, phone)")
      .single();
    if (baErr) return internalError(baErr);
    billingAccount = created;
  }
  const org = billingAccount.organizations as unknown as {
    name: string;
    email: string | null;
    document: string;
    phone: string | null;
  } | null;
  if (!org)
    return NextResponse.json({ error: "Billing account has no organization" }, { status: 500 });

  const { data: invoice, error: invErr } = await context.db
    .from("invoices")
    .insert({
      id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
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

  const customerId = await findOrCreateAsaasCustomer({
    existingCustomerId: billingAccount.gateway_customer_id,
    name: org.name,
    document: org.document,
    email: org.email ?? context.email,
    phone: org.phone,
  });
  if (!billingAccount.gateway_customer_id) {
    await context.db
      .from("billing_accounts")
      .update({ gateway_customer_id: customerId })
      .eq("id", billingAccount.id);
  }

  const payment = await createOneOffCharge({
    customerId,
    valueCents: depositCents,
    description: `Sinal (20%) — ${asset.name}`,
    action: "deposit",
    invoiceId: invoice.id,
    refId: reservation.id,
  });

  await context.db
    .from("invoices")
    .update({ gateway_checkout_id: payment.id })
    .eq("id", invoice.id);

  return NextResponse.json({
    data: { url: payment.invoiceUrl, reservationId: reservation.id, deposit, balance, total },
  });
}
