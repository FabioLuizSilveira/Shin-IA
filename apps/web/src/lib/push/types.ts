// Wave 4 Phase C — the Notification Engine (create-notification.ts,
// api/mobile/notifications) never imports Expo directly; it only ever sees
// this interface. Swapping providers later (FCM/APNs direct, or a
// multi-provider router) means implementing MobilePushProvider again, not
// touching delivery.ts or any notification-creation call site.
export interface PushMessage {
  to: string[]; // provider push tokens (Expo push tokens today)
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushDeliveryResult {
  token: string;
  status: "ok" | "error";
  // Provider-reported error code, e.g. Expo's "DeviceNotRegistered" — used
  // by delivery.ts to decide whether to disable the device, not just log.
  errorCode?: string;
}

export interface MobilePushProvider {
  send(input: PushMessage): Promise<PushDeliveryResult[]>;
}
