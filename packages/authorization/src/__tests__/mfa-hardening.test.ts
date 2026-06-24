import { describe, it, expect } from "vitest";
import { MfaHardeningService } from "../mfa/mfa-hardening.js";
import type { AuthorizationContext } from "../types.js";

describe("MfaHardeningService", () => {
  const service = new MfaHardeningService();

  const highTrustCtx: AuthorizationContext = {
    userId: "user-1",
    tenantId: "tenant-1",
    platformRole: "platform_admin",
    tenantRole: null,
    branchIds: [],
    capabilities: [],
    sessionTrustLevel: "HIGH",
    mfaVerified: true,
    isImpersonating: false,
  };

  describe("getRequirement", () => {
    it("should return no requirement for non-sensitive operations", () => {
      const req = service.getRequirement("tenant.branches:read");
      expect(req.required).toBe(false);
      expect(req.minimumTrustLevel).toBe("LOW");
    });

    it("should require HIGH for billing operations", () => {
      const req = service.getRequirement("billing.payment_method:change");
      expect(req.required).toBe(true);
      expect(req.minimumTrustLevel).toBe("HIGH");
    });

    it("should require VERY_HIGH for ownership transfer", () => {
      const req = service.getRequirement("tenant.ownership:transfer");
      expect(req.required).toBe(true);
      expect(req.minimumTrustLevel).toBe("VERY_HIGH");
    });

    it("should require VERY_HIGH for billing credits", () => {
      const req = service.getRequirement("billing.credits:create");
      expect(req.required).toBe(true);
      expect(req.minimumTrustLevel).toBe("VERY_HIGH");
    });

    it("should require VERY_HIGH for commission approval", () => {
      const req = service.getRequirement("finance.commission.rate:approve");
      expect(req.required).toBe(true);
      expect(req.minimumTrustLevel).toBe("VERY_HIGH");
    });
  });

  describe("checkStepUp", () => {
    it("should allow non-sensitive operations without MFA", () => {
      const lowCtx: AuthorizationContext = {
        ...highTrustCtx,
        sessionTrustLevel: "LOW",
        mfaVerified: false,
      };
      const result = service.checkStepUp(lowCtx, "tenant.branches:read");
      expect(result.allowed).toBe(true);
      expect(result.requiresStepUp).toBe(false);
    });

    it("should allow HIGH operation with HIGH trust + MFA", () => {
      const result = service.checkStepUp(highTrustCtx, "billing.payment_method:change");
      expect(result.allowed).toBe(true);
      expect(result.requiresStepUp).toBe(false);
    });

    it("should deny HIGH operation with MEDIUM trust", () => {
      const mediumCtx: AuthorizationContext = { ...highTrustCtx, sessionTrustLevel: "MEDIUM" };
      const result = service.checkStepUp(mediumCtx, "billing.payment_method:change");
      expect(result.allowed).toBe(false);
      expect(result.requiresStepUp).toBe(true);
      expect(result.requiredTrustLevel).toBe("HIGH");
    });

    it("should deny VERY_HIGH operation with HIGH trust", () => {
      const result = service.checkStepUp(highTrustCtx, "tenant.ownership:transfer");
      expect(result.allowed).toBe(false);
      expect(result.requiresStepUp).toBe(true);
      expect(result.requiredTrustLevel).toBe("VERY_HIGH");
    });

    it("should allow VERY_HIGH operation with VERY_HIGH trust + MFA", () => {
      const vhCtx: AuthorizationContext = { ...highTrustCtx, sessionTrustLevel: "VERY_HIGH" };
      const result = service.checkStepUp(vhCtx, "tenant.ownership:transfer");
      expect(result.allowed).toBe(true);
    });

    it("should deny when MFA not verified even with sufficient trust level", () => {
      const noMfaCtx: AuthorizationContext = {
        ...highTrustCtx,
        mfaVerified: false,
        sessionTrustLevel: "HIGH",
      };
      const result = service.checkStepUp(noMfaCtx, "billing.payment_method:change");
      expect(result.allowed).toBe(false);
      expect(result.requiresStepUp).toBe(true);
    });
  });

  describe("calculateTrustLevel", () => {
    it("should return LOW for impersonating sessions", () => {
      const level = service.calculateTrustLevel({
        mfaVerified: true,
        isImpersonating: true,
        recentMfaVerification: true,
        deviceTrusted: true,
      });
      expect(level).toBe("LOW");
    });

    it("should return LOW when MFA not verified", () => {
      const level = service.calculateTrustLevel({
        mfaVerified: false,
        isImpersonating: false,
        recentMfaVerification: false,
        deviceTrusted: false,
      });
      expect(level).toBe("LOW");
    });

    it("should return MEDIUM for MFA verified but not recent", () => {
      const level = service.calculateTrustLevel({
        mfaVerified: true,
        isImpersonating: false,
        recentMfaVerification: false,
        deviceTrusted: false,
      });
      expect(level).toBe("MEDIUM");
    });

    it("should return VERY_HIGH for trusted device + recent MFA", () => {
      const level = service.calculateTrustLevel({
        mfaVerified: true,
        isImpersonating: false,
        recentMfaVerification: true,
        deviceTrusted: true,
      });
      expect(level).toBe("VERY_HIGH");
    });

    it("should return HIGH for recent MFA but untrusted device", () => {
      const level = service.calculateTrustLevel({
        mfaVerified: true,
        isImpersonating: false,
        recentMfaVerification: true,
        deviceTrusted: false,
      });
      expect(level).toBe("HIGH");
    });
  });

  describe("isSufficientTrust", () => {
    it("should return true when current >= required", () => {
      expect(service.isSufficientTrust("HIGH", "MEDIUM")).toBe(true);
      expect(service.isSufficientTrust("VERY_HIGH", "HIGH")).toBe(true);
      expect(service.isSufficientTrust("HIGH", "HIGH")).toBe(true);
    });

    it("should return false when current < required", () => {
      expect(service.isSufficientTrust("LOW", "MEDIUM")).toBe(false);
      expect(service.isSufficientTrust("MEDIUM", "HIGH")).toBe(false);
      expect(service.isSufficientTrust("HIGH", "VERY_HIGH")).toBe(false);
    });
  });

  describe("getOperationsForLevel", () => {
    it("should return all VERY_HIGH operations", () => {
      const ops = service.getOperationsForLevel("VERY_HIGH");
      expect(ops).toContain("tenant.ownership:transfer");
      expect(ops).toContain("billing.credits:create");
      expect(ops).toContain("finance.commission.rate:approve");
      expect(ops).not.toContain("billing.payment_method:change"); // HIGH only
    });

    it("should include HIGH and VERY_HIGH for HIGH level query", () => {
      const ops = service.getOperationsForLevel("HIGH");
      expect(ops).toContain("billing.payment_method:change"); // HIGH
      expect(ops).toContain("tenant.ownership:transfer"); // VERY_HIGH
    });
  });
});
