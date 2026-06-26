import { describe, it, expect, beforeEach, vi } from "vitest";
import { PermissionEvaluator } from "../rbac/permission-evaluator.js";
import type { PlatformQueries, TenantQueries } from "@shina/iam-repository";
import type { AuthorizationContext } from "../types.js";

describe("PermissionEvaluator", () => {
  let mockPlatformQueries: PlatformQueries;
  let mockTenantQueries: TenantQueries;
  let evaluator: PermissionEvaluator;
  let ctx: AuthorizationContext;

  beforeEach(() => {
    mockPlatformQueries = {
      hasPermission: vi.fn().mockResolvedValue(true),
      getUserPermissions: vi.fn().mockResolvedValue([]),
      getActiveUserRoles: vi.fn().mockResolvedValue([]),
      getUserRoles: vi.fn().mockResolvedValue([]),
      grantRoleToUser: vi.fn(),
      revokeRoleFromUser: vi.fn(),
    } as any;

    mockTenantQueries = {
      hasPermission: vi.fn().mockResolvedValue(true),
      getUserPermissions: vi.fn().mockResolvedValue([]),
      getActiveUserRoles: vi.fn().mockResolvedValue([]),
      getUserRoles: vi.fn().mockResolvedValue([]),
      grantRoleToUser: vi.fn(),
      revokeRoleFromUser: vi.fn(),
      getUserRolesByBranch: vi.fn().mockResolvedValue([]),
    } as any;

    evaluator = new PermissionEvaluator({
      platformQueries: mockPlatformQueries,
      tenantQueries: mockTenantQueries,
    });

    ctx = {
      userId: "user-123",
      tenantId: "tenant-456",
      platformRole: "platform_admin",
      tenantRole: "tenant_owner",
      branchIds: ["branch-1"],
      capabilities: ["tracking.basic"],
      sessionTrustLevel: "HIGH",
      mfaVerified: true,
      isImpersonating: false,
    };
  });

  describe("MFA enforcement", () => {
    it("should deny MFA-required permission when MFA not verified", async () => {
      const noMfaCtx = { ...ctx, mfaVerified: false };
      const result = await evaluator.evaluate(noMfaCtx, "platform.tenants:suspend", "platform");
      expect(result.allowed).toBe(false);
      expect(result.requiresMfa).toBe(true);
    });

    it("should deny LOW trust level for MFA-required permission", async () => {
      const lowTrustCtx = { ...ctx, sessionTrustLevel: "LOW" as const, mfaVerified: false };
      const result = await evaluator.evaluate(lowTrustCtx, "platform.tenants:delete", "platform");
      expect(result.allowed).toBe(false);
      expect(result.requiresMfa).toBe(true);
    });

    it("should allow MFA-required permission when MFA verified", async () => {
      const result = await evaluator.evaluate(ctx, "platform.tenants:suspend", "platform");
      expect(result.allowed).toBe(true);
    });
  });

  describe("RBAC evaluation", () => {
    it("should check platform permissions for platform scope", async () => {
      await evaluator.evaluate(ctx, "platform.tenants:read", "platform");
      expect(mockPlatformQueries.hasPermission).toHaveBeenCalledWith(
        "user-123",
        "platform.tenants:read",
      );
    });

    it("should check tenant permissions for tenant scope", async () => {
      await evaluator.evaluate(ctx, "tenant.branches:manage", "tenant");
      expect(mockTenantQueries.hasPermission).toHaveBeenCalledWith(
        "tenant-456",
        "user-123",
        "tenant.branches:manage",
      );
    });

    it("should deny when hasPermission returns false", async () => {
      mockPlatformQueries.hasPermission = vi.fn().mockResolvedValue(false);
      const result = await evaluator.evaluate(ctx, "platform.tenants:create", "platform");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("does not have permission");
    });

    it("should deny tenant permission when tenantId is null", async () => {
      const noTenantCtx = { ...ctx, tenantId: null };
      const result = await evaluator.evaluate(noTenantCtx, "tenant.branches:read", "tenant");
      expect(result.allowed).toBe(false);
    });
  });

  describe("Approval signals", () => {
    it("should signal approval required for ownership transfer", async () => {
      const result = await evaluator.evaluate(ctx, "tenant.ownership:transfer", "tenant");
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });

    it("should not require approval for normal permissions", async () => {
      const result = await evaluator.evaluate(ctx, "tenant.branches:read", "tenant");
      expect(result.requiresApproval).toBeFalsy();
    });
  });
});
