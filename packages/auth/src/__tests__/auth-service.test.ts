// AuthService tests

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthService } from "../auth-service.js";
import type { AuthEventEmitter } from "../events/index.js";

describe("AuthService", () => {
  let authService: AuthService;
  let mockEventEmitter: AuthEventEmitter;

  beforeEach(() => {
    mockEventEmitter = {
      emit: vi.fn(),
    };

    authService = new AuthService({
      eventEmitter: mockEventEmitter,
    });
  });

  describe("JWT Claims", () => {
    it("should build valid JWT claims", () => {
      const claims = authService.buildJWTClaims(
        "user-123",
        "user@example.com",
        "tenant-123",
        "platform_admin",
        "tenant_owner",
        ["branch-1", "branch-2"],
        ["tracking.basic"],
      );

      expect(claims.sub).toBe("user-123");
      expect(claims.email).toBe("user@example.com");
      expect(claims.tenant_id).toBe("tenant-123");
      expect(claims.platform_role).toBe("platform_admin");
      expect(claims.tenant_role).toBe("tenant_owner");
      expect(claims.branch_ids).toEqual(["branch-1", "branch-2"]);
      expect(claims.capabilities).toEqual(["tracking.basic"]);
      expect(claims.iat).toBeLessThanOrEqual(claims.exp);
    });

    it("should validate JWT claims structure", () => {
      const validClaims = {
        sub: "user-123",
        email: "user@example.com",
        email_verified: true,
        tenant_id: "tenant-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      expect(authService.validateJWTClaims(validClaims)).toBe(true);
    });

    it("should reject invalid JWT claims", () => {
      const invalidClaims = {
        sub: "user-123",
        // missing email
        tenant_id: "tenant-123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      expect(authService.validateJWTClaims(invalidClaims)).toBe(false);
    });
  });

  describe("Services", () => {
    it("should expose session service", () => {
      const sessionService = authService.getSessionService();
      expect(sessionService).toBeDefined();
      expect(sessionService.getSessionDurationMinutes()).toBe(480); // 8 hours
    });

    it("should expose MFA service", () => {
      const mfaService = authService.getMFAService();
      expect(mfaService).toBeDefined();
    });

    it("should expose tenant context resolver", () => {
      const tenantContextResolver = authService.getTenantContextResolver();
      expect(tenantContextResolver).toBeDefined();
    });
  });
});
