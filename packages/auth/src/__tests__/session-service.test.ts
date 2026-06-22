// SessionService tests

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionService } from "../session-service.js";
import type { AuthEventEmitter } from "../events/index.js";

describe("SessionService", () => {
  let sessionService: SessionService;
  let mockEventEmitter: AuthEventEmitter;

  beforeEach(() => {
    mockEventEmitter = {
      emit: vi.fn(),
    };

    sessionService = new SessionService({
      sessionDurationMinutes: 480,
      inactivityTimeoutMinutes: 120,
      maxConcurrentSessions: 3,
      eventEmitter: mockEventEmitter,
    });
  });

  describe("Session Creation", () => {
    it("should create a valid session", () => {
      const session = sessionService.createSession("user-123", "tenant-123", "auth-token-abc", {
        ipAddress: "127.0.0.1",
        userAgent: "test",
      });

      expect(session.id).toBeDefined();
      expect(session.userId).toBe("user-123");
      expect(session.tenantId).toBe("tenant-123");
      expect(session.authSessionId).toBe("auth-token-abc");
      expect(session.status).toBe("active");
      expect(session.mfaVerified).toBe(false);
      expect(session.isImpersonated).toBe(false);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe("Session Expiry", () => {
    it("should detect expired session", () => {
      const session = sessionService.createSession("user-123", "tenant-123", "auth-token-abc");

      // Set expiry to past
      session.expiresAt = new Date(Date.now() - 1000);

      expect(sessionService.isSessionExpired(session)).toBe(true);
    });

    it("should detect inactivity timeout", () => {
      const session = sessionService.createSession("user-123", "tenant-123", "auth-token-abc");

      // Set last activity to past (beyond 2 hour timeout)
      session.lastActivityAt = new Date(Date.now() - 3 * 60 * 60 * 1000);

      expect(sessionService.isSessionExpired(session)).toBe(true);
    });

    it("should not expire active session", () => {
      const session = sessionService.createSession("user-123", "tenant-123", "auth-token-abc");

      expect(sessionService.isSessionExpired(session)).toBe(false);
    });
  });

  describe("Session MFA", () => {
    it("should mark session as MFA verified", () => {
      const session = sessionService.createSession("user-123", "tenant-123", "auth-token-abc");

      const updated = sessionService.markMFAVerified(session, "totp");

      expect(updated.mfaVerified).toBe(true);
      expect(updated.mfaMethod).toBe("totp");
      expect(updated.mfaVerifiedAt).toBeInstanceOf(Date);
    });
  });

  describe("Session Revocation", () => {
    it("should revoke session", () => {
      const session = sessionService.createSession("user-123", "tenant-123", "auth-token-abc");

      const revoked = sessionService.revokeSession(session);

      expect(revoked.status).toBe("revoked");
    });

    it("should expire session", () => {
      const session = sessionService.createSession("user-123", "tenant-123", "auth-token-abc");

      const expired = sessionService.expireSession(session);

      expect(expired.status).toBe("expired");
    });
  });

  describe("Activity Update", () => {
    it("should update session activity", () => {
      const session = sessionService.createSession("user-123", "tenant-123", "auth-token-abc");

      const originalActivity = session.lastActivityAt;
      // Wait a tiny bit to ensure time difference
      const updated = sessionService.updateSessionActivity(session);

      expect(updated.lastActivityAt.getTime()).toBeGreaterThanOrEqual(originalActivity.getTime());
    });
  });
});
