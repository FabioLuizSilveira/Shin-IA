// TenantContextResolver tests

import { describe, it, expect, beforeEach } from "vitest";
import { TenantContextResolver } from "../tenant-context.js";
import type { JWTClaims } from "../types.js";

describe("TenantContextResolver", () => {
  let resolver: TenantContextResolver;

  beforeEach(() => {
    resolver = new TenantContextResolver();
  });

  describe("Tenant Context Resolution", () => {
    it("should resolve tenant context from JWT claims", () => {
      const claims: JWTClaims = {
        sub: "user-123",
        email: "user@example.com",
        email_verified: true,
        tenant_id: "tenant-123",
        platform_role: "platform_admin",
        tenant_role: "tenant_owner",
        branch_ids: ["branch-1", "branch-2"],
        capabilities: ["tracking.basic"],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const context = resolver.resolveTenantContext(claims);

      expect(context.tenantId).toBe("tenant-123");
      expect(context.userId).toBe("user-123");
      expect(context.platformRole).toBe("platform_admin");
      expect(context.tenantRole).toBe("tenant_owner");
      expect(context.branchIds).toEqual(["branch-1", "branch-2"]);
      expect(context.capabilities).toEqual(["tracking.basic"]);
    });

    it("should throw error if tenant_id is missing", () => {
      const claims: Partial<JWTClaims> = {
        sub: "user-123",
        email: "user@example.com",
        email_verified: true,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      expect(() => resolver.resolveTenantContext(claims as JWTClaims)).toThrow(
        "missing tenant_id claim",
      );
    });
  });

  describe("Context Validation", () => {
    it("should validate valid tenant context", () => {
      const context = {
        tenantId: "123e4567-e89b-12d3-a456-426614174000",
        userId: "user-123",
        platformRole: "platform_admin",
        tenantRole: "tenant_owner",
        branchIds: ["123e4567-e89b-12d3-a456-426614174001"],
        capabilities: ["tracking.basic"],
      };

      expect(resolver.validateTenantContext(context)).toBe(true);
    });

    it("should reject context with invalid UUID in branchIds", () => {
      const context = {
        tenantId: "123e4567-e89b-12d3-a456-426614174000",
        userId: "user-123",
        branchIds: ["invalid-uuid"],
        capabilities: [],
      };

      expect(resolver.validateTenantContext(context)).toBe(false);
    });

    it("should validate tenant ID match", () => {
      const context = {
        tenantId: "tenant-123",
        userId: "user-123",
        branchIds: [],
        capabilities: [],
      };

      expect(resolver.validateTenantId(context, "tenant-123")).toBe(true);
      expect(resolver.validateTenantId(context, "tenant-456")).toBe(false);
    });
  });

  describe("Capability and Branch Scope", () => {
    it("should check if user has capability", () => {
      const context = {
        tenantId: "tenant-123",
        userId: "user-123",
        branchIds: [],
        capabilities: ["tracking.basic", "tracking.history"],
      };

      expect(resolver.hasCapability(context, "tracking.basic")).toBe(true);
      expect(resolver.hasCapability(context, "tracking.geofence")).toBe(false);
    });

    it("should get branch scope", () => {
      const context = {
        tenantId: "tenant-123",
        userId: "user-123",
        branchIds: ["branch-1", "branch-2", "branch-3"],
        capabilities: [],
      };

      expect(resolver.getBranchScope(context)).toEqual(["branch-1", "branch-2", "branch-3"]);
    });
  });
});
