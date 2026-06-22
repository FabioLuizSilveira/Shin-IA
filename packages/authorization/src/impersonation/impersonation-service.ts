import type { ImpersonationSessionRepository } from "@shina/iam-repository";
import type { ImpersonationSessionRow, ImpersonationAccessMode } from "@shina/iam-domain";
import type { AuthorizationContext } from "../types.js";

// Roles that cannot be impersonated without explicit permission
const PROTECTED_ROLES = new Set(["platform_owner", "tenant_owner"]);

// Maximum impersonation session duration in milliseconds (4 hours)
const MAX_IMPERSONATION_DURATION_MS = 4 * 60 * 60 * 1000;

export interface ImpersonationServiceDeps {
  impersonationRepository: ImpersonationSessionRepository;
}

export interface StartImpersonationInput {
  platformOperatorId: string;
  platformOperatorRole: string;
  tenantId: string;
  targetUserId: string;
  targetUserRole: string;
  accessMode: ImpersonationAccessMode;
  reason: string;
}

export interface EndImpersonationInput {
  sessionId: string;
  endedBy: string;
  reason?: string;
}

export interface ImpersonationSession {
  sessionId: string;
  impersonatingAs: string;
  tenantId: string;
  accessMode: ImpersonationAccessMode;
  startedAt: Date;
  expiresAt: Date;
  bannerMessage: string;
}

export class ImpersonationService {
  private repo: ImpersonationSessionRepository;

  constructor(deps: ImpersonationServiceDeps) {
    this.repo = deps.impersonationRepository;
  }

  async startImpersonation(input: StartImpersonationInput): Promise<ImpersonationSession> {
    // Protection: Platform Owner and Tenant Owner cannot be impersonated by default
    if (PROTECTED_ROLES.has(input.targetUserRole)) {
      const hasExplicitPermission = input.platformOperatorRole === "platform_owner";
      if (!hasExplicitPermission) {
        throw new Error(
          `Cannot impersonate a ${input.targetUserRole} — requires explicit Platform Owner permission`,
        );
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAX_IMPERSONATION_DURATION_MS);

    const row: ImpersonationSessionRow = {
      id: crypto.randomUUID(),
      tenant_id: input.tenantId,
      platform_actor_id: input.platformOperatorId,
      target_user_id: input.targetUserId,
      target_tenant_id: input.tenantId,
      reason: input.reason,
      access_mode: input.accessMode,
      secondary_auth_by: null,
      status: "active",
      started_at: now.toISOString(),
      ended_at: null,
      max_duration_minutes: MAX_IMPERSONATION_DURATION_MS / 60000,
      version: 1,
      metadata: {
        expires_at: expiresAt.toISOString(),
        target_user_role: input.targetUserRole,
        operator_role: input.platformOperatorRole,
      },
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      deleted_at: null,
    };

    const created = await this.repo.create(row);

    return {
      sessionId: created.id,
      impersonatingAs: input.targetUserId,
      tenantId: input.tenantId,
      accessMode: input.accessMode,
      startedAt: now,
      expiresAt,
      bannerMessage: this.buildBannerMessage(input, expiresAt),
    };
  }

  async endImpersonation(input: EndImpersonationInput): Promise<void> {
    const session = await this.repo.findById(input.sessionId);
    if (!session) throw new Error(`Impersonation session ${input.sessionId} not found`);
    if (session.ended_at !== null)
      throw new Error(`Impersonation session ${input.sessionId} already ended`);

    const now = new Date().toISOString();
    await this.repo.update({
      ...session,
      ended_at: now,
      ended_by: input.endedBy,
      ended_reason: input.reason ?? "manual",
      status: "revoked",
      updated_at: now,
      version: session.version + 1,
    } as ImpersonationSessionRow);
  }

  async expireOverdueSessions(): Promise<number> {
    const ongoing = await this.repo.findOngoing();
    const now = new Date();
    let expired = 0;

    for (const session of ongoing) {
      const expiresAt = session.metadata?.expires_at
        ? new Date(session.metadata.expires_at as string)
        : null;

      if (expiresAt && now > expiresAt) {
        const nowStr = now.toISOString();
        await this.repo.update({
          ...session,
          ended_at: nowStr,
          ended_by: "system",
          ended_reason: "expired",
          status: "expired",
          updated_at: nowStr,
          version: session.version + 1,
        } as ImpersonationSessionRow);
        expired++;
      }
    }

    return expired;
  }

  async getOngoingSessions(operatorId: string) {
    return this.repo.findActiveByOperator(operatorId);
  }

  async getImpersonationHistory(tenantId: string, userId: string) {
    return this.repo.findByImpersonatedUser(tenantId, userId);
  }

  isImpersonating(ctx: AuthorizationContext): boolean {
    return ctx.isImpersonating;
  }

  getBannerForContext(ctx: AuthorizationContext): string | null {
    if (!ctx.isImpersonating) return null;
    return `⚠️ IMPERSONATION ACTIVE — You are acting as another user. All actions are logged.`;
  }

  private buildBannerMessage(input: StartImpersonationInput, expiresAt: Date): string {
    const mode = input.accessMode === "read_only" ? "READ-ONLY" : "FULL ACCESS";
    return (
      `⚠️ IMPERSONATION SESSION ACTIVE [${mode}] — ` +
      `Operator ${input.platformOperatorId} is impersonating user ${input.targetUserId}. ` +
      `Session expires at ${expiresAt.toISOString()}. All actions are logged.`
    );
  }
}
