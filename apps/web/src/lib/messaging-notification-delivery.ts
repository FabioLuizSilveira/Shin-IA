import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyContactViaWhatsApp, type ConsentPurpose } from "@shina/messaging-platform";
import { getEntitlements } from "@shina/commercial-platform";
import { createConfiguredMessagingProvider } from "@/lib/messaging-provider-factory";
import { buildDeepLinkUrl, type DeepLinkTarget } from "@/lib/push/deep-link";
import { logActivity } from "@/lib/activity-log";

const FLAG = "messaging.whatsapp.enabled";
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

export interface DeliverWhatsAppOptions {
  deepLink?: DeepLinkTarget;
  purpose?: ConsentPurpose;
}

/**
 * WAVE 3 — the WhatsApp fan-out for createNotification(), same role as
 * deliverPushForNotification() plays for push. Only fires for a real,
 * single identifiable recipient ("customer:<id>"/"operator:<id>") — never
 * for a tenant-wide broadcast. Every existing createNotification() call
 * site that already passes a `recipient` (e.g. infraction driver
 * identification -> operator) gains WhatsApp reach with zero changes to
 * that call site.
 */
export async function deliverWhatsAppForNotification(
  db: SupabaseClient,
  notification: {
    id: string;
    tenant_id: string;
    recipient_external_ref: string;
    subject: string;
    body: string;
  },
  options: DeliverWhatsAppOptions = {},
): Promise<void> {
  const [kind] = notification.recipient_external_ref.split(":");
  if (kind !== "customer" && kind !== "operator") return; // never a tenant broadcast

  const { data: flagRow } = await db
    .from("tenant_feature_flags")
    .select("enabled")
    .eq("tenant_id", notification.tenant_id)
    .eq("flag_key", FLAG)
    .maybeSingle();
  if (!flagRow?.enabled) return;

  const entitlements = await getEntitlements(db, {
    tenantId: notification.tenant_id,
    product: "platform",
  });
  if (!entitlements.features.includes("messaging_whatsapp")) return;

  const provider = createConfiguredMessagingProvider(db);
  const result = await notifyContactViaWhatsApp(db, provider, {
    tenantId: notification.tenant_id,
    recipientExternalRef: notification.recipient_external_ref,
    subject: notification.subject,
    body: notification.body,
    ctaUrl: options.deepLink ? buildDeepLinkUrl(options.deepLink) : null,
    purpose: options.purpose ?? "operational",
    entitlementActive: true,
  });

  void logActivity(db, {
    tenantId: notification.tenant_id,
    actorId: SYSTEM_ACTOR_ID,
    entityType: "notification",
    entityId: notification.id,
    action: "notification.whatsapp_delivered",
    metadata: { sent: result.sent, reason: result.reason },
  });
}
