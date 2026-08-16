import type { MobilePushProvider, PushMessage, PushDeliveryResult } from "./types";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoTicket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

// Wave 4 Phase C — apps/mobile is React Native/Expo (confirmed: app.json
// has no bare FCM/APNs config, only the Expo-managed workflow), so Expo
// Push Service is the real, already-applicable provider — not a second one
// invented alongside a "just in case" FCM/APNs direct integration. No API
// key is required for basic sends (an EXPO_ACCESS_TOKEN is optional,
// Expo's own "enhanced security" feature, wired up if set).
export class ExpoPushProvider implements MobilePushProvider {
  async send(input: PushMessage): Promise<PushDeliveryResult[]> {
    if (input.to.length === 0) return [];

    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(
        input.to.map((token) => ({
          to: token,
          title: input.title,
          body: input.body,
          data: input.data ?? {},
        })),
      ),
    });

    if (!res.ok) {
      return input.to.map((token) => ({
        token,
        status: "error" as const,
        errorCode: `http_${res.status}`,
      }));
    }

    const json = (await res.json().catch(() => ({}))) as { data?: ExpoTicket[] };
    const tickets = json.data ?? [];
    return input.to.map((token, i) => {
      const ticket = tickets[i];
      if (!ticket) return { token, status: "error" as const, errorCode: "no_ticket" };
      return { token, status: ticket.status, errorCode: ticket.details?.error };
    });
  }
}
