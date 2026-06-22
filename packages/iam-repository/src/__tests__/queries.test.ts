import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PlatformQueries, TenantQueries, DelegationQueries } from "../queries/index.js";

describe("IAM Query Helpers", () => {
  let mockDb: SupabaseClient;

  beforeEach(() => {
    mockDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any;
  });

  describe("PlatformQueries", () => {
    it("should create platform queries instance", () => {
      const queries = new PlatformQueries({ db: mockDb });
      expect(queries).toBeDefined();
    });

    it("should have methods for role and permission queries", () => {
      const queries = new PlatformQueries({ db: mockDb });
      expect(queries.getUserRoles).toBeDefined();
      expect(queries.getActiveUserRoles).toBeDefined();
      expect(queries.getUserPermissions).toBeDefined();
      expect(queries.grantRoleToUser).toBeDefined();
      expect(queries.revokeRoleFromUser).toBeDefined();
      expect(queries.hasPermission).toBeDefined();
    });

    it("should handle empty user roles", async () => {
      mockDb.from = vi.fn().mockReturnThis();
      mockDb.select = vi.fn().mockReturnThis();
      mockDb.eq = vi.fn().mockReturnThis();
      mockDb.is = vi.fn().mockResolvedValue({ data: [], error: null });

      const queries = new PlatformQueries({ db: mockDb });
      const permissions = await queries.getUserPermissions("user-123");
      expect(permissions).toEqual([]);
    });
  });

  describe("TenantQueries", () => {
    it("should create tenant queries instance", () => {
      const queries = new TenantQueries({ db: mockDb });
      expect(queries).toBeDefined();
    });

    it("should have methods for tenant role and permission queries", () => {
      const queries = new TenantQueries({ db: mockDb });
      expect(queries.getUserRoles).toBeDefined();
      expect(queries.getActiveUserRoles).toBeDefined();
      expect(queries.getUserPermissions).toBeDefined();
      expect(queries.grantRoleToUser).toBeDefined();
      expect(queries.revokeRoleFromUser).toBeDefined();
      expect(queries.hasPermission).toBeDefined();
      expect(queries.getUserRolesByBranch).toBeDefined();
    });

    it("should handle branch scopes", async () => {
      const queries = new TenantQueries({ db: mockDb });
      mockDb.from = vi.fn().mockReturnThis();
      mockDb.select = vi.fn().mockReturnThis();
      mockDb.eq = vi.fn().mockResolvedValue({ data: [], error: null });

      await queries.getUserRolesByBranch("branch-123");
      expect(mockDb.from).toHaveBeenCalled();
    });
  });

  describe("DelegationQueries", () => {
    it("should create delegation queries instance", () => {
      const queries = new DelegationQueries({ db: mockDb });
      expect(queries).toBeDefined();
    });

    it("should have methods for delegated access queries", () => {
      const queries = new DelegationQueries({ db: mockDb });
      expect(queries.getActiveGrantsForGrantee).toBeDefined();
      expect(queries.getGrantsFromGrantor).toBeDefined();
      expect(queries.getExpiredGrants).toBeDefined();
    });

    it("should have methods for impersonation queries", () => {
      const queries = new DelegationQueries({ db: mockDb });
      expect(queries.getActiveImpersonationSessions).toBeDefined();
      expect(queries.getImpersonationHistoryForUser).toBeDefined();
      expect(queries.getOngoingImpersonations).toBeDefined();
    });

    it("should have methods for approval queries", () => {
      const queries = new DelegationQueries({ db: mockDb });
      expect(queries.getPendingApprovalsForWorkflow).toBeDefined();
      expect(queries.getApprovalsBySubject).toBeDefined();
      expect(queries.getTenantApprovals).toBeDefined();
      expect(queries.getExpiredApprovals).toBeDefined();
      expect(queries.getApprovalSteps).toBeDefined();
      expect(queries.getPendingApprovalSteps).toBeDefined();
      expect(queries.getActorPendingApprovals).toBeDefined();
    });
  });
});
