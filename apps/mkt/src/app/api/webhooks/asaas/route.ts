import { NextResponse } from "next/server";
import { activateFromWebhook } from "@shina/commercial-platform";
import { mapAsaasEventToNormalized } from "@shina/billing-platform";
import { createAdminClient } from "@/lib/supabase/admin";

// Asaas equivalent of api/webhooks/stripe (Fase B of the Stripe -> Asaas
// migration) — the MKT product's only webhook (unlike apps/web, MKT has
// no separate AR/invoices module to disambiguate from).
//
// Auth: a static shared-secret header comparison (asaas-access-token),
// not an HMAC over the body — confirmed against docs.asaas.com. The
// token is chosen by whoever configures the webhook in the Asaas
// dashboard and stored as ASAAS_WEBHOOK_AUTH_TOKEN.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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

  let envelope: { id?: string; event?: string };
  try {
    envelope = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  if (!envelope.id || !envelope.event) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalized = mapAsaasEventToNormalized(envelope as any);
    const sync = await activateFromWebhook(admin, normalized);
    if (sync.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    console.error("[asaas webhook] sync failed:", err);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }

  // KNOWN GAP, not silently dropped: the Stripe route's 14-day refund
  // guarantee (on customer.subscription.deleted, refund the last payment
  // intent if still within the window) is NOT reimplemented here yet.
  // Asaas has its own refund endpoint (POST /v3/payments/{id}/refund),
  // but reaching it needs: (a) resolving which payment to refund from a
  // SUBSCRIPTION_DELETED event (which carries no payment id directly --
  // needs a PAYMENT_* lookup by subscription id), and (b) the same live-
  // sandbox verification discipline every other Asaas endpoint in this
  // migration got, not a guess. Tracked as a follow-up, not part of
  // Fase B's core webhook plumbing.

  return NextResponse.json({ received: true });
}
