import { describe, it, expect, beforeEach, vi } from "vitest";
import { DelegatedAccessService } from "../delegated-access/delegated-access-service.js";
import type { DelegatedAccessRepository } from "@shina/iam-repository";
import { DelegatedAccessRequest } from "@shina/iam-domain";

const makeRow = (overrides = {}) => ({
  id: "delegation-1",
  tenant_id: "tenant-1",
  grantor_id: "user-grantor",
  grantee_id: "user-grantee",
  permissions: ["tenant.branches:read"],
  branch_ids: ["branch-1"],
  reason: "temp access",
  status: "active" as const,
  granted_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString(), // +1 day
  revoked_at: null,
  revoked_by: null,
  version: 1,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
});

describe("DelegatedAccessService", () => {
  let mockRepo: DelegatedAccessRepository;
  let service: DelegatedAccessService;

  beforeEach(() => {
    mockRepo = {
      create: vi
        .fn()
        .mockImplementation((entity: DelegatedAccessRequest) => Promise.resolve(entity)),
      update: vi
        .fn()
        .mockImplementation((entity: DelegatedAccessRequest) => Promise.resolve(entity)),
      findById: vi.fn().mockResolvedValue(new DelegatedAccessRequest(makeRow())),
      findActiveByGrantee: vi.fn().mockResolvedValue([new DelegatedAccessRequest(makeRow())]),
      findByGrantee: vi.fn().mockResolvedValue([new DelegatedAccessRequest(makeRow())]),
      findByGrantor: vi.fn().mockResolvedValue([]),
      findExpiredAndActive: vi.fn().mockResolvedValue([]),
      softDelete: vi.fn(),
      hardDelete: vi.fn(),
      restore: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
    } as any;

    service = new DelegatedAccessService({ delegatedAccessRepository: mockRepo });
  });

  describe("grantDelegation", () => {
    it("should create an active delegation", async () => {
      const result = await service.grantDelegation({
        tenantId: "tenant-1",
        grantorId: "user-grantor",
        granteeId: "user-grantee",
        permissions: ["tenant.branches:read"],
        branchIds: ["branch-1"],
        reason: "temp access",
        expiresAt: new Date(Date.now() + 86400000),
      });

      expect(mockRepo.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("revokeDelegation", () => {
    it("should revoke an active delegation", async () => {
      await service.revokeDelegation({
        delegationId: "delegation-1",
        revokedBy: "admin-user",
        reason: "no longer needed",
      });

      expect(mockRepo.update).toHaveBeenCalled();
    });

    it("should throw when delegation not found", async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(
        service.revokeDelegation({ delegationId: "missing-id", revokedBy: "admin" }),
      ).rejects.toThrow("not found");
    });

    it("should throw when delegation is already revoked", async () => {
      mockRepo.findById = vi
        .fn()
        .mockResolvedValue(new DelegatedAccessRequest(makeRow({ status: "revoked" })));

      await expect(
        service.revokeDelegation({ delegationId: "delegation-1", revokedBy: "admin" }),
      ).rejects.toThrow("not active");
    });
  });

  describe("expireOverdueDelegations", () => {
    it("should expire all overdue active delegations", async () => {
      const expiredRow = makeRow({
        expires_at: new Date(Date.now() - 1000).toISOString(),
      });
      mockRepo.findExpiredAndActive = vi
        .fn()
        .mockResolvedValue([new DelegatedAccessRequest(expiredRow)]);

      const count = await service.expireOverdueDelegations();
      expect(count).toBe(1);
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it("should return 0 when no delegations are overdue", async () => {
      const count = await service.expireOverdueDelegations();
      expect(count).toBe(0);
    });
  });

  describe("hasDelegatedPermission", () => {
    it("should return true when grantee has the delegated permission", async () => {
      const result = await service.hasDelegatedPermission({
        tenantId: "tenant-1",
        granteeId: "user-grantee",
        permission: "tenant.branches:read",
      });
      expect(result).toBe(true);
    });

    it("should return false when permission not in delegation", async () => {
      const result = await service.hasDelegatedPermission({
        tenantId: "tenant-1",
        granteeId: "user-grantee",
        permission: "tenant.finance:manage",
      });
      expect(result).toBe(false);
    });

    it("should check branch restriction", async () => {
      const allowed = await service.hasDelegatedPermission({
        tenantId: "tenant-1",
        granteeId: "user-grantee",
        permission: "tenant.branches:read",
        branchId: "branch-1",
      });
      const denied = await service.hasDelegatedPermission({
        tenantId: "tenant-1",
        granteeId: "user-grantee",
        permission: "tenant.branches:read",
        branchId: "branch-99",
      });
      expect(allowed).toBe(true);
      expect(denied).toBe(false);
    });
  });

  describe("auditUserDelegations", () => {
    it("should return grants and received delegations", async () => {
      const ctx = {
        userId: "user-grantor",
        tenantId: "tenant-1",
        platformRole: null,
        tenantRole: "tenant_owner",
        branchIds: [],
        capabilities: [],
        sessionTrustLevel: "HIGH" as const,
        mfaVerified: true,
        isImpersonating: false,
      };

      const result = await service.auditUserDelegations(ctx);
      expect(result.granted).toBeDefined();
      expect(result.received).toBeDefined();
    });

    it("should return empty when no tenantId", async () => {
      const ctx = {
        userId: "user-1",
        tenantId: null,
        platformRole: "platform_admin",
        tenantRole: null,
        branchIds: [],
        capabilities: [],
        sessionTrustLevel: "HIGH" as const,
        mfaVerified: true,
        isImpersonating: false,
      };

      const result = await service.auditUserDelegations(ctx);
      expect(result.granted).toEqual([]);
      expect(result.received).toEqual([]);
    });
  });
});
