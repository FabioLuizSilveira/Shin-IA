import type { PushTokenRecord, PushNotificationPayload, PushPlatform } from "./types.js";
import { MobileRuntimeError } from "./offline-sync.js";

export class PushNotificationManager {
  private readonly tokens = new Map<string, PushTokenRecord>();
  private readonly notifications = new Map<string, PushNotificationPayload>();

  registerToken(record: PushTokenRecord): void {
    const key = `${record.tenantId}:${record.userId}`;
    this.tokens.set(key, { ...record });
  }

  getToken(tenantId: string, userId: string): PushTokenRecord | undefined {
    return this.tokens.get(`${tenantId}:${userId}`);
  }

  unregisterToken(tenantId: string, userId: string): void {
    const key = `${tenantId}:${userId}`;
    if (!this.tokens.has(key)) {
      throw new MobileRuntimeError(`Token not found for user ${userId}`, "TOKEN_NOT_FOUND");
    }
    this.tokens.delete(key);
  }

  listTokensByPlatform(platform: PushPlatform): PushTokenRecord[] {
    return [...this.tokens.values()].filter((t) => t.platform === platform);
  }

  schedule(notification: PushNotificationPayload): void {
    if (this.notifications.has(notification.id)) {
      throw new MobileRuntimeError(
        `Notification already exists: ${notification.id}`,
        "DUPLICATE_NOTIFICATION",
      );
    }
    this.notifications.set(notification.id, { ...notification });
  }

  deliver(id: string): PushNotificationPayload {
    const n = this.notifications.get(id);
    if (!n) throw new MobileRuntimeError(`Notification not found: ${id}`, "NOTIFICATION_NOT_FOUND");
    if (n.status === "cancelled")
      throw new MobileRuntimeError(`Notification is cancelled: ${id}`, "ALREADY_CANCELLED");
    const delivered = { ...n, status: "delivered" as const, deliveredAt: new Date().toISOString() };
    this.notifications.set(id, delivered);
    return delivered;
  }

  cancel(id: string): void {
    const n = this.notifications.get(id);
    if (!n) throw new MobileRuntimeError(`Notification not found: ${id}`, "NOTIFICATION_NOT_FOUND");
    if (n.status === "delivered")
      throw new MobileRuntimeError(`Cannot cancel delivered notification`, "ALREADY_DELIVERED");
    this.notifications.set(id, { ...n, status: "cancelled" });
  }

  listPending(): PushNotificationPayload[] {
    return [...this.notifications.values()].filter((n) => n.status === "pending");
  }

  getDeliveryStatus(id: string): PushNotificationPayload["status"] {
    const n = this.notifications.get(id);
    if (!n) throw new MobileRuntimeError(`Notification not found: ${id}`, "NOTIFICATION_NOT_FOUND");
    return n.status;
  }
}
