import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConfiguredMessagingProvider } from "@/lib/messaging-provider-factory";
import { applyMessagingEvent } from "@shina/messaging-platform";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";
import { newCorrelationId } from "@/lib/audit-event";

export const dynamic = "force-dynamic";

// Meta's GET verification handshake (spec section 5/38, confirmed against
// current Meta docs): ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
// — echo hub.challenge back as plain text once the verify token matches.
// No Supabase session ever exists here (server-to-server, same posture as
// api/webhooks/fleet-location) — /api/webhooks/* is exempted in
// middleware.ts's APP_PUBLIC_PATHS.
export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const provider = createConfiguredMessagingProvider(admin);
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const challenge = provider.verifyWebhookSubscription(query);
  if (challenge === null) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

// Inbound message/status webhook. tenantId is NEVER read from the payload
// (spec section 4, P0 absolute) — applyMessagingEvent() resolves it
// server-side from the canonical event's externalPhoneNumberId ->
// messaging_channels row. Signature verification uses the RAW body text
// (req.text(), never req.json()) — see MetaWhatsAppProvider.verifyWebhook's
// own comment for why.
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const provider = createConfiguredMessagingProvider(admin);

  const rawBody = await req.text();
  const headers: Record<string, string | null> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  if (!provider.verifyWebhook(rawBody, headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events;
  try {
    events = await provider.normalizeWebhook(rawBody, headers);
  } catch (err) {
    console.error("[webhooks/messaging/whatsapp] normalize failed", err);
    // Ack 200 anyway — a malformed-but-authentic payload shouldn't trigger
    // Meta's retry storm; the failure is logged server-side for follow-up.
    return NextResponse.json({ data: { received: 0 } });
  }

  const correlationId = newCorrelationId();
  for (const event of events) {
    try {
      const result = await applyMessagingEvent(admin, event);
      if (result.handled && result.tenantId) {
        await logActivity(admin, {
          tenantId: result.tenantId,
          actorId: "00000000-0000-0000-0000-000000000000",
          actorType: "system",
          correlationId,
          entityType: "messaging_message",
          entityId:
            result.messageId ?? result.conversationId ?? result.messagingChannelId ?? "unknown",
          action:
            event.kind === "message_received"
              ? MESSAGING_AUDIT_EVENTS.MESSAGE_RECEIVED
              : event.kind === "message_failed"
                ? MESSAGING_AUDIT_EVENTS.MESSAGE_FAILED
                : MESSAGING_AUDIT_EVENTS.MESSAGE_SENT,
          metadata: { eventKind: event.kind, providerEventId: event.providerEventId },
        });
      }
    } catch (err) {
      // One malformed event never blocks the rest of the batch.
      console.error("[webhooks/messaging/whatsapp] applyMessagingEvent failed", err);
    }
  }

  return NextResponse.json({ data: { received: events.length } });
}
