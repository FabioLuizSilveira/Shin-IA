import { NextResponse } from "next/server";
import { applySignatureEvent, createSignatureProvider } from "@shina/signature-platform";
import { createAdminClient } from "@/lib/supabase/admin";

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
      await applySignatureEvent(admin, provider, event);
    }
  } catch (err) {
    console.error("[clicksign webhook] apply failed:", err);
    return NextResponse.json({ error: "apply failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
