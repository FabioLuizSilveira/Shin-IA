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

const ASAAS_BASE =
  process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

async function asaas<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY ?? "",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Asaas ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  return body as T;
}

// 14-day money-back guarantee (subscription signup, no free tier — see
// signup/page.tsx's own comment): reimplements what the old Stripe route
// did on customer.subscription.deleted, using Asaas's own refund endpoint.
// Live-verified what's verifiable without a real payment (the sandbox has
// no API to simulate one, same limitation Fase B's webhook envelope had
// before its own real delivery): the GET /payments query shape (params,
// response shape) against a real subscription, and POST .../refund's real
// rejection of a non-refundable (PENDING) payment -- confirms the route,
// method and this function's own only-CONFIRMED/RECEIVED gating are all
// correct. Not yet exercised end-to-end against an actually-paid,
// actually-refunded payment.
// Eligibility is computed from OUR OWN platform_subscriptions.created_at,
// not gateway-side metadata (Stripe's version used subscription metadata;
// Asaas's checkout has no generic metadata bag to mirror that with) — the
// subscription row's creation time is exactly the signup moment already.
// Best-effort: a refund failure is logged, never fails the webhook
// response — the cancellation itself already succeeded via
// activateFromWebhook, and Asaas retries deliveries on a non-200, which
// would be worse than a merely-unrefunded cancellation.
async function refundIfWithinGuaranteeWindow(
  admin: ReturnType<typeof createAdminClient>,
  gatewaySubscriptionId: string,
): Promise<void> {
  const { data: sub } = await admin
    .from("platform_subscriptions")
    .select("id, created_at")
    .eq("gateway_subscription_id", gatewaySubscriptionId)
    .eq("product", "mkt")
    .maybeSingle();
  if (!sub) return;

  const eligibleUntil = new Date(sub.created_at).getTime() + REFUND_WINDOW_MS;
  if (Date.now() > eligibleUntil) return;

  interface AsaasPayment {
    id: string;
    status: string;
    dateCreated: string;
  }
  const payments = await asaas<{ data: AsaasPayment[] }>(
    `/payments?subscription=${gatewaySubscriptionId}&status=CONFIRMED&limit=1&sort=dateCreated&order=desc`,
  );
  let payment = payments.data[0];
  if (!payment) {
    const received = await asaas<{ data: AsaasPayment[] }>(
      `/payments?subscription=${gatewaySubscriptionId}&status=RECEIVED&limit=1&sort=dateCreated&order=desc`,
    );
    payment = received.data[0];
  }
  if (!payment) return;

  await asaas(`/payments/${payment.id}/refund`, { method: "POST", body: JSON.stringify({}) });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized = mapAsaasEventToNormalized(envelope as any);
  try {
    const sync = await activateFromWebhook(admin, normalized);
    if (sync.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    console.error("[asaas webhook] sync failed:", err);
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }

  if (normalized.kind === "subscription_cancelled" && normalized.gatewaySubscriptionId) {
    try {
      await refundIfWithinGuaranteeWindow(admin, normalized.gatewaySubscriptionId);
    } catch (err) {
      // Best-effort — see refundIfWithinGuaranteeWindow's own comment.
      console.error("[asaas webhook] 14-day refund attempt failed:", err);
    }
  }

  return NextResponse.json({ received: true });
}
