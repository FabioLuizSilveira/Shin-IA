import { NextResponse } from "next/server";
import { activateFromWebhook } from "@shina/commercial-platform";
import { mapAsaasEventToNormalized } from "@shina/billing-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-log";

// Asaas equivalent of api/webhooks/stripe-commercial (Fase B of the
// Stripe -> Asaas migration) — same "platform" product, same
// activateFromWebhook validation, same tenants.status flip logic. Never
// merge with a future api/webhooks/asaas (that one, if built in Fase C,
// is the unrelated AR/invoices one-off-payment module).
//
// Auth: a static shared-secret header comparison (asaas-access-token),
// not an HMAC over the body -- confirmed against docs.asaas.com. The
// token itself is chosen by whoever configures the webhook in the Asaas
// dashboard and stored here as ASAAS_WEBHOOK_AUTH_TOKEN.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized = mapAsaasEventToNormalized(envelope as any);
  try {
    const result = await activateFromWebhook(admin, normalized);
    if (result.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Same Platform-specific tenants.status flip as the Stripe route —
    // applyBillingEvent (inside activateFromWebhook) has no notion of it.
    if (result.handled && normalized.kind === "checkout_completed") {
      const checkoutRefId = normalized.checkoutRefId;
      if (checkoutRefId) {
        const { data: ref } = await admin
          .from("checkout_session_references")
          .select("tenant_id, user_id, plan_version_id, product")
          .eq("id", checkoutRefId)
          .maybeSingle();
        if (ref?.product === "platform" && ref.tenant_id) {
          const { data: planVersion } = await admin
            .from("plan_versions")
            .select("trial_days")
            .eq("id", ref.plan_version_id)
            .maybeSingle();
          await admin
            .from("tenants")
            .update({ status: (planVersion?.trial_days ?? 0) > 0 ? "trialing" : "active" })
            .eq("id", ref.tenant_id);
          void logActivity(admin, {
            tenantId: ref.tenant_id,
            actorId: ref.user_id,
            entityType: "subscription",
            entityId: result.subscriptionId ?? checkoutRefId,
            action: "subscription.activated",
          });
        }
      }
    }
  } catch (err) {
    console.error("[asaas-commercial webhook] sync failed:", err);
    // Non-200 makes Asaas retry the delivery — losing activation silently
    // is worse than a retried webhook (applyBillingEvent is idempotent).
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
