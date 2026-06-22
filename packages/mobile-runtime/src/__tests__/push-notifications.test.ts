import { describe, it, expect, beforeEach } from "vitest";
import { PushNotificationManager } from "../push-notifications.js";
import { MobileRuntimeError } from "../offline-sync.js";
import type { PushTokenRecord, PushNotificationPayload } from "../types.js";

function makeToken(userId = "u1", platform: "apns" | "fcm" = "fcm"): PushTokenRecord {
  return {
    tenantId: "t1",
    userId,
    token: `tok-${userId}`,
    platform,
    registeredAt: "2024-01-01T00:00:00Z",
  };
}

function makeNotification(id = "n1", userId = "u1"): PushNotificationPayload {
  return {
    id,
    tenantId: "t1",
    userId,
    title: "Test",
    body: "Hello",
    status: "pending",
  };
}

describe("PushNotificationManager", () => {
  let mgr: PushNotificationManager;

  beforeEach(() => {
    mgr = new PushNotificationManager();
  });

  describe("registerToken / getToken", () => {
    it("registers and retrieves a token", () => {
      mgr.registerToken(makeToken());
      expect(mgr.getToken("t1", "u1")).toBeTruthy();
    });

    it("returns undefined for unknown user", () => {
      expect(mgr.getToken("t1", "unknown")).toBeUndefined();
    });

    it("overwrites existing token on re-register", () => {
      mgr.registerToken(makeToken("u1", "fcm"));
      mgr.registerToken({ ...makeToken("u1"), platform: "apns" });
      expect(mgr.getToken("t1", "u1")?.platform).toBe("apns");
    });
  });

  describe("unregisterToken", () => {
    it("removes a token", () => {
      mgr.registerToken(makeToken());
      mgr.unregisterToken("t1", "u1");
      expect(mgr.getToken("t1", "u1")).toBeUndefined();
    });

    it("throws TOKEN_NOT_FOUND for missing token", () => {
      expect(() => mgr.unregisterToken("t1", "u99")).toThrow(MobileRuntimeError);
    });
  });

  describe("listTokensByPlatform", () => {
    it("filters by platform", () => {
      mgr.registerToken(makeToken("u1", "fcm"));
      mgr.registerToken(makeToken("u2", "apns"));
      expect(mgr.listTokensByPlatform("fcm")).toHaveLength(1);
      expect(mgr.listTokensByPlatform("apns")).toHaveLength(1);
    });
  });

  describe("schedule / listPending", () => {
    it("schedules a notification", () => {
      mgr.schedule(makeNotification());
      expect(mgr.listPending()).toHaveLength(1);
    });

    it("throws DUPLICATE_NOTIFICATION on duplicate id", () => {
      mgr.schedule(makeNotification());
      expect(() => mgr.schedule(makeNotification())).toThrow(MobileRuntimeError);
    });
  });

  describe("deliver", () => {
    it("marks notification as delivered", () => {
      mgr.schedule(makeNotification());
      const result = mgr.deliver("n1");
      expect(result.status).toBe("delivered");
      expect(result.deliveredAt).toBeTruthy();
    });

    it("throws NOTIFICATION_NOT_FOUND for unknown id", () => {
      expect(() => mgr.deliver("missing")).toThrow(MobileRuntimeError);
    });

    it("throws ALREADY_CANCELLED if notification is cancelled", () => {
      mgr.schedule(makeNotification());
      mgr.cancel("n1");
      expect(() => mgr.deliver("n1")).toThrow(MobileRuntimeError);
    });
  });

  describe("cancel", () => {
    it("cancels a pending notification", () => {
      mgr.schedule(makeNotification());
      mgr.cancel("n1");
      expect(mgr.getDeliveryStatus("n1")).toBe("cancelled");
    });

    it("throws NOTIFICATION_NOT_FOUND for unknown id", () => {
      expect(() => mgr.cancel("missing")).toThrow(MobileRuntimeError);
    });

    it("throws ALREADY_DELIVERED if already delivered", () => {
      mgr.schedule(makeNotification());
      mgr.deliver("n1");
      expect(() => mgr.cancel("n1")).toThrow(MobileRuntimeError);
    });
  });

  describe("getDeliveryStatus", () => {
    it("returns status of known notification", () => {
      mgr.schedule(makeNotification());
      expect(mgr.getDeliveryStatus("n1")).toBe("pending");
    });

    it("throws NOTIFICATION_NOT_FOUND for unknown id", () => {
      expect(() => mgr.getDeliveryStatus("missing")).toThrow(MobileRuntimeError);
    });
  });
});
