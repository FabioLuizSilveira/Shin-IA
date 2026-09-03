import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseOneOffExternalReference } from "@/lib/asaas/client";
import { settleAssetOwnersForPaidInvoice } from "@/lib/asset-owner-settlement";

export const dynamic = "force-dynamic";

// Asaas equivalent of the OLD webhooks/stripe/route.ts (Fase C of the
// Stripe -> Asaas migration) — the AR/invoices one-off-payment module
// (deposit/balance/renewal/invoice), NOT the same thing as
// webhooks/asaas-commercial (that one is the Unified Commercial Flow's
// platform SaaS subscription webhook, Fase B; different product,
// different DB tables, never merge them — same separation the old Stripe
// routes already kept).
//
// Auth: static shared-secret header comparison (asaas-access-token), same
// pattern as asaas-commercial/route.ts and apps/mkt's asaas webhook.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface AsaasPaymentWebhookEnvelope {
  id?: string;
  event?: string;
  payment?: { id: string; externalReference?: string | null };
}

export async function POST(request: Request) {
  const authToken = process.env.ASAAS_WEBHOOK_AUTH_TOKEN;
  const receivedToken = request.headers.get("asaas-access-token");
  if (!authToken) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 500 });
  }
  if (!receivedToken || !timingSafeEqual(receivedToken, authToken)) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  let envelope: AsaasPaymentWebhookEnvelope;
  try {
    envelope = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  if (!envelope.id || !envelope.event) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // Only PAYMENT_CONFIRMED (card, immediate) and PAYMENT_RECEIVED (Pix/
  // boleto, settles same-day in sandbox) count as "paid" — mirrors the old
  // Stripe route's single checkout.session.completed trigger. Every other
  // event (PAYMENT_OVERDUE, PAYMENT_DELETED, ...) is a no-op 200, same as
  // the Stripe route silently ignoring any event.type it didn't check for.
  if (envelope.event !== "PAYMENT_CONFIRMED" && envelope.event !== "PAYMENT_RECEIVED") {
    return NextResponse.json({ received: true });
  }

  const ref = parseOneOffExternalReference(envelope.payment?.externalReference);
  if (!ref) {
    return NextResponse.json({ received: true });
  }
  const { action, invoiceId, refId } = ref;
  const paymentId = envelope.payment?.id ?? null;

  const admin = createAdminClient();
  // Idempotency: only ever transitions an invoice OUT of issued/overdue,
  // and only when it still matches the payment id this webhook created —
  // a re-delivered event finds status already "paid" and the .eq() below
  // matches zero rows, same no-op-on-retry shape applyBillingEvent uses
  // elsewhere via platform_billing_events' unique index.
  const { data: updatedInvoice } = await admin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      gateway_payment_intent_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("gateway_checkout_id", paymentId)
    .in("status", ["issued", "overdue"])
    .select("id, tenant_id, contract_id, total_amount, total_currency")
    .maybeSingle();

  if (!updatedInvoice) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (action === "invoice" && updatedInvoice.contract_id) {
    void settleAssetOwnersForPaidInvoice(admin, {
      tenantId: updatedInvoice.tenant_id,
      invoiceId: updatedInvoice.id,
      contractId: updatedInvoice.contract_id,
      totalAmount: Number(updatedInvoice.total_amount),
      currency: updatedInvoice.total_currency,
    });
  }

  if (action === "renewal" && refId) {
    const { data: contract } = await admin
      .from("contracts")
      .select("period_ends_at")
      .eq("id", refId)
      .maybeSingle();
    if (contract) {
      const newEnd = new Date(
        new Date(contract.period_ends_at).getTime() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      await admin
        .from("contracts")
        .update({ period_ends_at: newEnd, status: "active" })
        .eq("id", refId);
    }
  }

  if (action === "deposit" && refId) {
    await admin
      .from("rental_reservations")
      .update({ status: "reserved", updated_at: new Date().toISOString() })
      .eq("id", refId)
      .eq("status", "pending_deposit");
  }

  if (action === "balance" && refId) {
    const { data: reservation } = await admin
      .from("rental_reservations")
      .select(
        "id, tenant_id, organization_id, asset_id, period_starts_at, period_ends_at, total_amount, total_currency, status",
      )
      .eq("id", refId)
      .maybeSingle();
    if (reservation && reservation.status === "reserved") {
      const { data: newContract } = await admin
        .from("contracts")
        .insert({
          id: crypto.randomUUID(),
          tenant_id: reservation.tenant_id,
          organization_id: reservation.organization_id,
          type: "rental",
          status: "active",
          value_amount: reservation.total_amount,
          value_currency: reservation.total_currency,
          period_starts_at: reservation.period_starts_at,
          period_ends_at: reservation.period_ends_at,
          metadata: { reservation_id: reservation.id },
        })
        .select("id")
        .single();
      if (newContract) {
        await admin.from("contract_assets").insert({
          tenant_id: reservation.tenant_id,
          contract_id: newContract.id,
          asset_id: reservation.asset_id,
          quantity: 1,
        });
        await admin.from("assets").update({ status: "in_use" }).eq("id", reservation.asset_id);
        await admin
          .from("rental_reservations")
          .update({
            status: "completed",
            contract_id: newContract.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reservation.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
