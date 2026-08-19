import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

// checkout.session.completed marks the corresponding invoice as paid. The
// session's `metadata.invoice_id` (set in /api/invoices/[id]/checkout) is
// the link back to the invoices table — no user session exists here, so
// this uses the admin client.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;
    const action = session.metadata?.action;
    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : null;

    if (invoiceId) {
      const admin = createAdminClient();
      await admin
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .eq("stripe_checkout_session_id", session.id);

      // The three mobile customer-renewal actions (api/mobile/customer/*)
      // all funnel through this same invoice-paid event — paying IS what
      // renews/reserves/finalizes, there is no separate "confirm" step a
      // human has to click. See each route's own comment for why.
      if (action === "renewal" && session.metadata?.contract_id) {
        const { data: contract } = await admin
          .from("contracts")
          .select("period_ends_at")
          .eq("id", session.metadata.contract_id)
          .maybeSingle();
        if (contract) {
          const newEnd = new Date(
            new Date(contract.period_ends_at).getTime() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString();
          await admin
            .from("contracts")
            .update({ period_ends_at: newEnd, status: "active" })
            .eq("id", session.metadata.contract_id);
        }
      }

      if (action === "deposit" && session.metadata?.reservation_id) {
        await admin
          .from("rental_reservations")
          .update({ status: "reserved", updated_at: new Date().toISOString() })
          .eq("id", session.metadata.reservation_id)
          .eq("status", "pending_deposit");
      }

      if (action === "balance" && session.metadata?.reservation_id) {
        const { data: reservation } = await admin
          .from("rental_reservations")
          .select(
            "id, tenant_id, organization_id, asset_id, period_starts_at, period_ends_at, total_amount, total_currency, status",
          )
          .eq("id", session.metadata.reservation_id)
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
    }
  }

  return NextResponse.json({ received: true });
}
