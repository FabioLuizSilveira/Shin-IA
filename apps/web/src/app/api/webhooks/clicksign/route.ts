import { NextResponse } from "next/server";
import { applySignatureEvent, createSignatureProvider } from "@shina/signature-platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { getSignatureEventNotificationCopy } from "@/lib/signature-notification-copy";

// POST /api/webhooks/clicksign — real webhook receiver. Reads the body as
// TEXT, never .json() — Clicksign authenticates webhooks via HMAC over the
// exact raw bytes (per this adapter's own build notes; see
// docs/integrations/CLICKSIGN.md for what's confirmed vs. still needs a
// live sandbox check), and re-serializing a parsed object would not
// reproduce the exact bytes that were signed. Same idempotent-apply /
// retry-on-500 shape as the existing api/webhooks/asaas* routes — this
// endpoint is globally exempted from session auth by middleware.ts's
// APP_PUBLIC_PATHS (matches every other /api/webhooks/* route), so
// authenticity is enforced entirely by the HMAC check inside
// provider.normalizeWebhook(), not by any session/cookie here.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers: Record<string, string | null> = {
    "x-clicksign-signature": request.headers.get("x-clicksign-signature"),
  };

  // TEMP diagnostic (2026-09-04): the assumed x-clicksign-signature
  // header never arrives on real deliveries — log every header name
  // Clicksign actually sends so the real one can be identified, then
  // remove this once CLICKSIGN.md's HMAC gap is closed for real. Header
  // NAMES only (never values — one of them may carry a real secret).
  console.log("[clicksign webhook] header keys received:", [...request.headers.keys()].join(","));

  // Always instantiated fresh from SIGNATURE_PROVIDER — this route never
  // assumes it's Clicksign specifically, even though today it's the only
  // provider registered at this specific URL path (a future second
  // provider gets its own /api/webhooks/<provider> route, never a shared
  // one, since each provider's webhook auth mechanism is provider-specific).
  const provider = createSignatureProvider();
  const admin = createAdminClient();

  let events;
  try {
    events = await provider.normalizeWebhook(rawBody, headers);
  } catch (err) {
    console.error("[clicksign webhook] verification/parsing failed:", err);
    return NextResponse.json({ error: "invalid webhook" }, { status: 401 });
  }

  try {
    for (const event of events) {
      const result = await applySignatureEvent(admin, provider, event);

      // Side effects only for events this run actually applied (not
      // duplicates/unhandled) and that resolved to a real tenant/contract
      // — see ApplySignatureEventResult's own comment: the package never
      // fires these itself, only this app-layer caller does.
      if (result.handled && !result.duplicate && result.tenantId && result.contractId) {
        // actorId comes from signature_requests.created_by (whoever
        // requested the signature) — always populated in practice, since
        // the only creation path (POST /api/signature-requests) always
        // sets it. Skipped rather than logged with a made-up actor if it
        // is ever somehow missing — tenant_activity_log.actor_id has no
        // real "system" placeholder convention anywhere else in this app.
        if (result.actorId) {
          void logActivity(admin, {
            tenantId: result.tenantId,
            actorId: result.actorId,
            entityType: "contract",
            entityId: result.contractId,
            action: event.kind,
            metadata: { signatureRequestId: result.signatureRequestId, provider: event.provider },
          });
        }

        const copy = getSignatureEventNotificationCopy(event.kind);
        if (copy && !copy.logOnly) {
          void createNotification({
            tenantId: result.tenantId,
            subject: copy.subject,
            body: copy.body,
            priority: copy.priority,
            deepLink: { type: "contract", id: result.contractId },
          });
        }
      }
    }
  } catch (err) {
    console.error("[clicksign webhook] apply failed:", err);
    return NextResponse.json({ error: "apply failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
