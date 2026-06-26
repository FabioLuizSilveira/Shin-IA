// MFAService tests

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MFAService } from "../mfa-service.js";
import type { AuthEventEmitter } from "../events/index.js";

describe("MFAService", () => {
  let mfaService: MFAService;
  let mockEventEmitter: AuthEventEmitter;

  beforeEach(() => {
    mockEventEmitter = {
      emit: vi.fn(),
    };

    mfaService = new MFAService({ eventEmitter: mockEventEmitter });
  });

  describe("TOTP Generation", () => {
    it("should generate TOTP secret", () => {
      const result = mfaService.generateTOTPSecret("user@example.com");

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.qrCode).toBeDefined();
      expect(result.qrCode).toContain("otpauth://");
    });
  });

  describe("Recovery Codes", () => {
    it("should generate recovery codes", () => {
      const codes = mfaService.generateRecoveryCodes(10);

      expect(codes).toHaveLength(10);
      codes.forEach((code) => {
        expect(code).toHaveLength(8);
        expect(/^[A-Z0-9]{8}$/.test(code)).toBe(true);
      });
    });

    it("should verify valid recovery code", () => {
      const codes = mfaService.generateRecoveryCodes(5);
      const recoveryCodeObjects = codes.map((code) => ({
        id: `code-${code}`,
        code,
        used: false,
        usedAt: null,
      }));

      const matched = mfaService.verifyRecoveryCode(recoveryCodeObjects, codes[0]);

      expect(matched).toBeDefined();
      expect(matched?.code).toBe(codes[0]);
    });

    it("should not verify used recovery code", () => {
      const codes = mfaService.generateRecoveryCodes(5);
      const recoveryCodeObjects = codes.map((code) => ({
        id: `code-${code}`,
        code,
        used: true,
        usedAt: new Date(),
      }));

      const matched = mfaService.verifyRecoveryCode(recoveryCodeObjects, codes[0]);

      expect(matched).toBeNull();
    });
  });

  describe("Events", () => {
    it("should emit MFA enrolled event", async () => {
      await mfaService.emitMFAEnrolled("tenant-123", "user-123", "totp");

      expect(mockEventEmitter.emit).toHaveBeenCalled();
      const call = (mockEventEmitter.emit as any).mock.calls[0];
      expect(call[0].eventType).toBe("auth.mfa.enrolled");
      expect(call[0].tenantId).toBe("tenant-123");
      expect(call[0].userId).toBe("user-123");
    });

    it("should emit MFA verified event", async () => {
      await mfaService.emitMFAVerified("tenant-123", "user-123", "session-456", "totp");

      expect(mockEventEmitter.emit).toHaveBeenCalled();
      const call = (mockEventEmitter.emit as any).mock.calls[0];
      expect(call[0].eventType).toBe("auth.mfa.verified");
    });

    it("should emit MFA failed event", async () => {
      await mfaService.emitMFAFailed("tenant-123", "totp", 1);

      expect(mockEventEmitter.emit).toHaveBeenCalled();
      const call = (mockEventEmitter.emit as any).mock.calls[0];
      expect(call[0].eventType).toBe("auth.mfa.failed");
    });
  });
});
