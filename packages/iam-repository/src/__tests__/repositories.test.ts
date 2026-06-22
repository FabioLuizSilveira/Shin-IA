import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PlatformRoleRepository,
  TenantRoleRepository,
  DelegatedAccessRepository,
  ApprovalRequestRepository,
} from "../repositories/index.js";

describe("IAM Repositories", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
    };
  });

  describe("PlatformRoleRepository", () => {
    it("should create repository with db dependency", () => {
      const repo = new PlatformRoleRepository({ db: mockDb });
      expect(repo.getTableName()).toBe("platform_roles");
    });

    it("should have table name", () => {
      const repo = new PlatformRoleRepository({ db: mockDb });
      expect(repo.getTableName()).toBe("platform_roles");
    });
  });

  describe("TenantRoleRepository", () => {
    it("should create repository with db dependency", () => {
      const repo = new TenantRoleRepository({ db: mockDb });
      expect(repo.getTableName()).toBe("tenant_roles");
    });

    it("should have table name", () => {
      const repo = new TenantRoleRepository({ db: mockDb });
      expect(repo.getTableName()).toBe("tenant_roles");
    });
  });

  describe("DelegatedAccessRepository", () => {
    it("should create repository with db dependency", () => {
      const repo = new DelegatedAccessRepository({ db: mockDb });
      expect(repo.getTableName()).toBe("delegated_access_requests");
    });
  });

  describe("ApprovalRequestRepository", () => {
    it("should create repository with db dependency", () => {
      const repo = new ApprovalRequestRepository({ db: mockDb });
      expect(repo.getTableName()).toBe("approval_requests");
    });
  });

  describe("Soft Delete Support", () => {
    it("should support soft delete", async () => {
      const repo = new PlatformRoleRepository({ db: mockDb });
      mockDb.from = vi.fn().mockReturnThis();
      mockDb.update = vi.fn().mockReturnThis();
      mockDb.eq = vi.fn().mockResolvedValue({ error: null });

      await repo.softDelete("role-123");
      expect(mockDb.from).toHaveBeenCalledWith("platform_roles");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should support restore from soft delete", async () => {
      const repo = new PlatformRoleRepository({ db: mockDb });
      mockDb.from = vi.fn().mockReturnThis();
      mockDb.update = vi.fn().mockReturnThis();
      mockDb.eq = vi.fn().mockReturnThis();
      mockDb.select = vi.fn().mockReturnThis();
      mockDb.single = vi.fn().mockResolvedValue({ data: null, error: null });

      const result = await repo.restore("role-123");
      expect(result).toBeNull(); // Mock returns null
    });
  });

  describe("Query Filtering", () => {
    it("should filter by status", async () => {
      const repo = new ApprovalRequestRepository({ db: mockDb });
      mockDb.from = vi.fn().mockReturnThis();
      mockDb.select = vi.fn().mockReturnThis();
      mockDb.eq = vi.fn().mockReturnThis();
      mockDb.is = vi.fn().mockReturnThis();
      mockDb.order = vi.fn().mockResolvedValue({ data: [], error: null });

      await repo.findPendingByWorkflow("tenant_ownership_transfer");
      expect(mockDb.from).toHaveBeenCalledWith("approval_requests");
      expect(mockDb.eq).toHaveBeenCalledWith("workflow_type", "tenant_ownership_transfer");
    });
  });
});
