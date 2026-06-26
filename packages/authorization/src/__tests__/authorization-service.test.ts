import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthorizationService } from "../authorization-service.js";
import type { PermissionEvaluator } from "../rbac/permission-evaluator.js";
import type { RoleResolver } from "../rbac/role-resolver.js";
import type { AuthorizationContext } from "../types.js";

describe("AuthorizationService", () => {
  let mockPermissionEvaluator: PermissionEvaluator;
  let mockRoleResolver: RoleResolver;
  let service: AuthorizationService;
  let ctx: AuthorizationContext;

  beforeEach(() => {
    mockPermissionEvaluator = {
      evaluate: vi.fn().mockResolvedValue({ allowed: true, reason: "Permission granted" }),
    } as any;

    mockRoleResolver = {
      resolve: vi.fn().mockResolvedValue({
        platformRoles: [],
        tenantRoles: [],
        effectivePlatformPermissions: [],
        effectiveTenantPermissions: [],
      }),
      hasRole: vi.fn().mockResolvedValue(false),
    } as any;

    service = new AuthorizationService({
      permissionEvaluator: mockPermissionEvaluator,
      roleResolver: mockRoleResolver,
    });

    ctx = AuthorizationService.buildContext(
      "user-123",
      "tenant-456",
      "platform_admin",
      "tenant_owner",
      ["branch-1"],
      ["tracking.basic"],
      { sessionTrustLevel: "HIGH", mfaVerified: true },
    );
  });

  describe("buildContext", () => {
    it("should build context with defaults", () => {
      const minimalCtx = AuthorizationService.buildContext(
        "user-1",
        "tenant-1",
        null,
        null,
        [],
        [],
      );
      expect(minimalCtx.sessionTrustLevel).toBe("MEDIUM");
      expect(minimalCtx.mfaVerified).toBe(false);
      expect(minimalCtx.isImpersonating).toBe(false);
    });

    it("should build context with custom options", () => {
      expect(ctx.userId).toBe("user-123");
      expect(ctx.tenantId).toBe("tenant-456");
      expect(ctx.sessionTrustLevel).toBe("HIGH");
      expect(ctx.mfaVerified).toBe(true);
    });
  });

  describe("authorize", () => {
    it("should grant access when RBAC passes", async () => {
      const result = await service.authorize(ctx, "tenants:read", "platform");
      expect(result.allowed).toBe(true);
    });

    it("should deny access when RBAC fails", async () => {
      mockPermissionEvaluator.evaluate = vi.fn().mockResolvedValue({
        allowed: false,
        reason: "User does not have permission",
      });

      const result = await service.authorize(ctx, "platform.tenants:delete", "platform");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("permission");
    });

    it("should deny when tenant mismatch (ABAC)", async () => {
      const result = await service.authorize(ctx, "tenants:read", "tenant", {
        tenantId: "other-tenant",
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("different tenant");
    });

    it("should pass when resource tenant matches context", async () => {
      const result = await service.authorize(ctx, "tenants:read", "tenant", {
        tenantId: "tenant-456",
      });
      expect(result.allowed).toBe(true);
    });

    it("should signal approval required for sensitive operations", async () => {
      mockPermissionEvaluator.evaluate = vi.fn().mockResolvedValue({
        allowed: true,
        reason: "Permission granted",
        requiresApproval: true,
      });

      const result = await service.authorize(ctx, "tenant.ownership:transfer", "tenant");
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
    });
  });

  describe("hasCapability", () => {
    it("should return true when user has capability", () => {
      expect(service.hasCapability(ctx, "tracking.basic")).toBe(true);
    });

    it("should return false when user lacks capability", () => {
      expect(service.hasCapability(ctx, "tracking.advanced")).toBe(false);
    });
  });

  describe("evaluateBranchScope", () => {
    it("root scope allows any branch", () => {
      const result = service.evaluateBranchScope(ctx, { branchId: "any-branch" }, { mode: "root" });
      expect(result).toBe(true);
    });

    it("branch scope requires exact match", () => {
      const allowed = service.evaluateBranchScope(
        ctx,
        { branchId: "branch-1" },
        { mode: "branch" },
      );
      const denied = service.evaluateBranchScope(ctx, { branchId: "branch-2" }, { mode: "branch" });
      expect(allowed).toBe(true);
      expect(denied).toBe(false);
    });

    it("custom scope uses explicit list", () => {
      const result = service.evaluateBranchScope(
        ctx,
        { branchId: "branch-X" },
        { mode: "custom", branchIds: ["branch-X", "branch-Y"] },
      );
      expect(result).toBe(true);
    });
  });

  describe("resolveUserRoles", () => {
    it("should resolve roles via role resolver", async () => {
      const resolved = await service.resolveUserRoles(ctx);
      expect(resolved.platformRoles).toEqual([]);
      expect(resolved.effectivePlatformPermissions).toEqual([]);
    });
  });
});
