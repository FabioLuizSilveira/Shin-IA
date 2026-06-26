import type { PlatformQueries, TenantQueries } from "@shina/iam-repository";
import type { AuthorizationContext, AuthorizationScope, AuthorizationResult } from "../types.js";

// Permissions that require MFA step-up (from ACCESS_MATRIX.md)
const MFA_REQUIRED_PERMISSIONS = new Set([
  "platform.tenants:suspend",
  "platform.tenants:reactivate",
  "platform.tenants:delete",
  "platform.impersonation:start",
  "platform.billing.credits:create",
  "platform.billing.refunds:approve",
  "platform.audit:delete",
  "platform.config:manage",
  "tenant.ownership:transfer",
  "tenant.billing:manage",
  "tenant.finance.reports:export",
]);

// Permissions that require an approval workflow
const APPROVAL_REQUIRED_PERMISSIONS = new Set([
  "tenant.ownership:transfer",
  "platform.tenants:delete",
  "tenant.role.delegation:grant",
  "tenant.commission.rate:approve",
  "platform.billing.plans:delete",
]);

export interface PermissionEvaluatorDeps {
  platformQueries: PlatformQueries;
  tenantQueries: TenantQueries;
}

export class PermissionEvaluator {
  private platformQueries: PlatformQueries;
  private tenantQueries: TenantQueries;

  constructor(deps: PermissionEvaluatorDeps) {
    this.platformQueries = deps.platformQueries;
    this.tenantQueries = deps.tenantQueries;
  }

  async evaluate(
    ctx: AuthorizationContext,
    permission: string,
    scope: AuthorizationScope,
  ): Promise<AuthorizationResult> {
    // Check MFA requirement first
    const requiresMfa = MFA_REQUIRED_PERMISSIONS.has(permission);
    if (requiresMfa && !ctx.mfaVerified) {
      return {
        allowed: false,
        reason: `Permission '${permission}' requires MFA verification`,
        requiresMfa: true,
      };
    }

    // Check trust level for sensitive operations
    if (requiresMfa && ctx.sessionTrustLevel === "LOW") {
      return {
        allowed: false,
        reason: `Permission '${permission}' requires elevated session trust level`,
        requiresMfa: true,
      };
    }

    const hasPermission =
      scope === "platform"
        ? await this.checkPlatformPermission(ctx, permission)
        : await this.checkTenantPermission(ctx, permission);

    if (!hasPermission) {
      return {
        allowed: false,
        reason: `User does not have permission '${permission}'`,
      };
    }

    const requiresApproval = APPROVAL_REQUIRED_PERMISSIONS.has(permission);

    return {
      allowed: true,
      reason: "Permission granted",
      requiresApproval,
    };
  }

  private async checkPlatformPermission(
    ctx: AuthorizationContext,
    permission: string,
  ): Promise<boolean> {
    if (!ctx.userId) return false;
    return this.platformQueries.hasPermission(ctx.userId, permission);
  }

  private async checkTenantPermission(
    ctx: AuthorizationContext,
    permission: string,
  ): Promise<boolean> {
    if (!ctx.userId || !ctx.tenantId) return false;
    return this.tenantQueries.hasPermission(ctx.tenantId, ctx.userId, permission);
  }
}
