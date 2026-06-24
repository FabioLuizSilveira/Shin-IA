import { describe, it, expect, beforeEach, vi } from "vitest";
import { ImpersonationService } from "../impersonation/impersonation-service.js";
import type { ImpersonationSessionRepository } from "@shina/iam-repository";
import type { ImpersonationSessionRow } from "@shina/iam-domain";

const makeSession = (
  overrides: Partial<ImpersonationSessionRow> = {},
): ImpersonationSessionRow => ({
  id: "session-1",
  tenant_id: "tenant-1",
  platform_actor_id: "operator-1",
  target_user_id: "user-target",
  target_tenant_id: "tenant-1",
  reason: "Support",
  access_mode: "full",
  secondary_auth_by: null,
  status: "active",
  started_at: new Date().toISOString(),
  ended_at: null,
  max_duration_minutes: 240,
  version: 1,
  metadata: { expires_at: new Date(Date.now() + 3600000).toISOString() },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
  ...overrides,
});

describe("ImpersonationService", () => {
  let mockRepo: ImpersonationSessionRepository;
  let service: ImpersonationService;

  beforeEach(() => {
    mockRepo = {
      create: vi.fn().mockImplementation((row: ImpersonationSessionRow) => Promise.resolve(row)),
      update: vi.fn().mockImplementation((row: ImpersonationSessionRow) => Promise.resolve(row)),
      findById: vi.fn().mockResolvedValue(makeSession()),
      findActiveByOperator: vi.fn().mockResolvedValue([makeSession()]),
      findByImpersonatedUser: vi.fn().mockResolvedValue([makeSession()]),
      findOngoing: vi.fn().mockResolvedValue([]),
      findByTenant: vi.fn().mockResolvedValue([]),
      softDelete: vi.fn(),
      hardDelete: vi.fn(),
      restore: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
    } as any;

    service = new ImpersonationService({ impersonationRepository: mockRepo });
  });

  describe("startImpersonation", () => {
    it("should start a session for a regular tenant user", async () => {
      const session = await service.startImpersonation({
        platformOperatorId: "operator-1",
        platformOperatorRole: "platform_support_n2",
        tenantId: "tenant-1",
        targetUserId: "user-target",
        targetUserRole: "tenant_manager",
        accessMode: "full",
        reason: "Support request #123",
      });

      expect(mockRepo.create).toHaveBeenCalled();
      expect(session.sessionId).toBeDefined();
      expect(session.accessMode).toBe("full");
      expect(session.expiresAt).toBeDefined();
    });

    it("should include banner message in session", async () => {
      const session = await service.startImpersonation({
        platformOperatorId: "operator-1",
        platformOperatorRole: "platform_admin",
        tenantId: "tenant-1",
        targetUserId: "user-target",
        targetUserRole: "tenant_manager",
        accessMode: "read_only",
        reason: "Audit",
      });

      expect(session.bannerMessage).toContain("IMPERSONATION SESSION ACTIVE");
      expect(session.bannerMessage).toContain("READ-ONLY");
    });

    it("should enforce 4-hour expiration", async () => {
      const session = await service.startImpersonation({
        platformOperatorId: "operator-1",
        platformOperatorRole: "platform_admin",
        tenantId: "tenant-1",
        targetUserId: "user-target",
        targetUserRole: "tenant_manager",
        accessMode: "full",
        reason: "Audit",
      });

      const durationMs = session.expiresAt.getTime() - session.startedAt.getTime();
      expect(durationMs).toBeLessThanOrEqual(4 * 60 * 60 * 1000 + 1000);
    });

    it("should deny impersonating tenant_owner by non-platform_owner", async () => {
      await expect(
        service.startImpersonation({
          platformOperatorId: "operator-1",
          platformOperatorRole: "platform_support_n2",
          tenantId: "tenant-1",
          targetUserId: "owner-user",
          targetUserRole: "tenant_owner",
          accessMode: "full",
          reason: "Support",
        }),
      ).rejects.toThrow("Cannot impersonate");
    });

    it("should deny impersonating platform_owner by non-platform_owner", async () => {
      await expect(
        service.startImpersonation({
          platformOperatorId: "operator-1",
          platformOperatorRole: "platform_admin",
          tenantId: "tenant-1",
          targetUserId: "platform-owner",
          targetUserRole: "platform_owner",
          accessMode: "full",
          reason: "Debug",
        }),
      ).rejects.toThrow("Cannot impersonate");
    });

    it("should allow platform_owner to impersonate tenant_owner", async () => {
      const session = await service.startImpersonation({
        platformOperatorId: "super-admin",
        platformOperatorRole: "platform_owner",
        tenantId: "tenant-1",
        targetUserId: "tenant-owner-user",
        targetUserRole: "tenant_owner",
        accessMode: "read_only",
        reason: "Legal audit",
      });

      expect(session.sessionId).toBeDefined();
    });
  });

  describe("endImpersonation", () => {
    it("should end an active impersonation session", async () => {
      await service.endImpersonation({
        sessionId: "session-1",
        endedBy: "operator-1",
        reason: "Done",
      });

      expect(mockRepo.update).toHaveBeenCalled();
    });

    it("should throw when session not found", async () => {
      mockRepo.findById = vi.fn().mockResolvedValue(null);

      await expect(
        service.endImpersonation({ sessionId: "missing", endedBy: "operator-1" }),
      ).rejects.toThrow("not found");
    });

    it("should throw when session already ended", async () => {
      mockRepo.findById = vi
        .fn()
        .mockResolvedValue(makeSession({ ended_at: new Date().toISOString() }));

      await expect(
        service.endImpersonation({ sessionId: "session-1", endedBy: "operator-1" }),
      ).rejects.toThrow("already ended");
    });
  });

  describe("expireOverdueSessions", () => {
    it("should expire sessions past their expiry", async () => {
      mockRepo.findOngoing = vi
        .fn()
        .mockResolvedValue([
          makeSession({ metadata: { expires_at: new Date(Date.now() - 1000).toISOString() } }),
        ]);

      const count = await service.expireOverdueSessions();
      expect(count).toBe(1);
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it("should not expire sessions still within duration", async () => {
      mockRepo.findOngoing = vi.fn().mockResolvedValue([makeSession()]);
      const count = await service.expireOverdueSessions();
      expect(count).toBe(0);
    });
  });

  describe("banner enforcement", () => {
    it("should return null banner when not impersonating", () => {
      const ctx = {
        userId: "user-1",
        tenantId: "tenant-1",
        platformRole: null,
        tenantRole: "tenant_owner",
        branchIds: [],
        capabilities: [],
        sessionTrustLevel: "HIGH" as const,
        mfaVerified: true,
        isImpersonating: false,
      };

      expect(service.getBannerForContext(ctx)).toBeNull();
      expect(service.isImpersonating(ctx)).toBe(false);
    });

    it("should return banner message when impersonating", () => {
      const ctx = {
        userId: "user-1",
        tenantId: "tenant-1",
        platformRole: null,
        tenantRole: "tenant_manager",
        branchIds: [],
        capabilities: [],
        sessionTrustLevel: "HIGH" as const,
        mfaVerified: true,
        isImpersonating: true,
      };

      expect(service.getBannerForContext(ctx)).toContain("IMPERSONATION ACTIVE");
      expect(service.isImpersonating(ctx)).toBe(true);
    });
  });
});
