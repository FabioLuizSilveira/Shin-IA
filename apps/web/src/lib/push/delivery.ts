import type { SupabaseClient } from "@supabase/supabase-js";
import type { MobilePushProvider, PushMessage } from "./types";
import type { DeepLinkTarget } from "./deep-link";
import { logActivity } from "@/lib/activity-log";

// Sentinel actor for automated/system-initiated audit entries — tenant_activity_log.actor_id
// is uuid not null, so a literal "system" string isn't valid; the nil UUID
// is the established convention in this codebase for "no real actor".
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

interface NotificationRow {
  id: string;
  tenant_id: string;
  recipient_external_ref: string;
  priority: string;
}

// Resolves recipient_external_ref (the same "kind:id" convention
// create-notification.ts already writes — Wave 3 Phase D) back to real
// auth.uid() values. "tenant:<id>" broadcasts to every active staff member
// via user_profiles (tenant_id + auth_user_id already exist there — no new
// table). Never trusts anything except the notification row itself, which
// is only ever written server-side.
async function resolveRecipientUserIds(
  db: SupabaseClient,
  recipientRef: string,
): Promise<string[]> {
  const [kind, id] = recipientRef.split(":");

  if (kind === "customer" && id) {
    const { data } = await db
      .from("rental_customers")
      .select("auth_user_id")
      .eq("id", id)
      .maybeSingle();
    return data?.auth_user_id ? [data.auth_user_id as string] : [];
  }

  if (kind === "operator" && id) {
    const { data } = await db
      .from("operators")
      .select("auth_user_id")
      .eq("id", id)
      .not("auth_user_id", "is", null)
      .maybeSingle();
    return data?.auth_user_id ? [data.auth_user_id as string] : [];
  }

  if (kind === "tenant" && id) {
    const { data } = await db
      .from("user_profiles")
      .select("auth_user_id")
      .eq("tenant_id", id)
      .eq("status", "active")
      .is("deleted_at", null);
    return (data ?? []).map((r) => r.auth_user_id as string);
  }

  return [];
}

// Privacy (Wave 4 Phase C item 7) — lock-screen text is always a generic
// category message, never the real subject/body (which can contain amounts,
// customer names, contract terms). Detail only renders after the user opens
// the app and is authenticated — the push payload's `data.notificationId`
// is just an opaque pointer for the app to fetch the real content via the
// already-authenticated GET /api/mobile/notifications.
function genericPushCopy(priority: string): { title: string; body: string } {
  if (priority === "critical" || priority === "high") {
    return { title: "Shinã", body: "Você tem uma atualização importante." };
  }
  return { title: "Shinã", body: "Você tem uma nova atualização." };
}

export interface DeliverPushOptions {
  deepLink?: DeepLinkTarget;
}

// Delivery pipeline (Wave 4 Phase C item 4):
// notification row -> resolve recipient -> resolve registered devices ->
// provider adapter -> push delivery -> delivery result -> audit.
export async function deliverPushForNotification(
  db: SupabaseClient,
  provider: MobilePushProvider,
  notification: NotificationRow,
  options: DeliverPushOptions = {},
): Promise<void> {
  const userIds = await resolveRecipientUserIds(db, notification.recipient_external_ref);
  if (userIds.length === 0) return;

  const { data: devices } = await db
    .from("mobile_devices")
    .select("id, push_token")
    .in("user_id", userIds)
    .eq("enabled", true)
    .not("push_token", "is", null);
  const eligibleDevices = (devices ?? []).filter((d) => d.push_token);
  if (eligibleDevices.length === 0) return;

  const copy = genericPushCopy(notification.priority);
  const message: PushMessage = {
    to: eligibleDevices.map((d) => d.push_token as string),
    title: copy.title,
    body: copy.body,
    data: {
      notificationId: notification.id,
      ...(options.deepLink ? { deepLink: options.deepLink } : {}),
    },
  };

  const results = await provider.send(message);

  // Token Lifecycle (item 6) — a provider explicitly reporting the token
  // is no longer valid (Expo's "DeviceNotRegistered") disables that device
  // immediately; it is never retried and never resurrected automatically.
  const invalidDeviceIds = results
    .map((result, i) => ({ result, device: eligibleDevices[i] }))
    .filter(({ result }) => result.status === "error" && result.errorCode === "DeviceNotRegistered")
    .map(({ device }) => device?.id)
    .filter((id): id is string => Boolean(id));
  if (invalidDeviceIds.length > 0) {
    await db
      .from("mobile_devices")
      .update({ enabled: false, push_token: null, updated_at: new Date().toISOString() })
      .in("id", invalidDeviceIds);
  }

  void logActivity(db, {
    tenantId: notification.tenant_id,
    actorId: SYSTEM_ACTOR_ID,
    entityType: "notification",
    entityId: notification.id,
    action: "notification.push_delivered",
    metadata: {
      deviceCount: eligibleDevices.length,
      okCount: results.filter((r) => r.status === "ok").length,
      invalidTokenCount: invalidDeviceIds.length,
    },
  });
}
