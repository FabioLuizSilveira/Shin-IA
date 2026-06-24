import type { PlatformQueries, TenantQueries } from "@shina/iam-repository";
import type { AuthorizationContext } from "../types.js";

export interface RoleResolverDeps {
  platformQueries: PlatformQueries;
  tenantQueries: TenantQueries;
}

export interface ResolvedRoles {
  platformRoles: string[];
  tenantRoles: string[];
  effectivePlatformPermissions: string[];
  effectiveTenantPermissions: string[];
}

export class RoleResolver {
  private platformQueries: PlatformQueries;
  private tenantQueries: TenantQueries;

  constructor(deps: RoleResolverDeps) {
    this.platformQueries = deps.platformQueries;
    this.tenantQueries = deps.tenantQueries;
  }

  async resolve(ctx: AuthorizationContext): Promise<ResolvedRoles> {
    const [platformRoleRows, tenantRoleRows] = await Promise.all([
      this.platformQueries.getActiveUserRoles(ctx.userId),
      ctx.tenantId
        ? this.tenantQueries.getActiveUserRoles(ctx.tenantId, ctx.userId)
        : Promise.resolve([]),
    ]);

    const [platformPermissions, tenantPermissions] = await Promise.all([
      this.platformQueries.getUserPermissions(ctx.userId),
      ctx.tenantId
        ? this.tenantQueries.getUserPermissions(ctx.tenantId, ctx.userId)
        : Promise.resolve([]),
    ]);

    return {
      platformRoles: platformRoleRows.map((r) => r.role_id),
      tenantRoles: tenantRoleRows.map((r) => r.role_id),
      effectivePlatformPermissions: platformPermissions.map((p) => p.key),
      effectiveTenantPermissions: tenantPermissions.map((p) => p.key),
    };
  }

  async hasRole(
    ctx: AuthorizationContext,
    roleKey: string,
    scope: "platform" | "tenant",
  ): Promise<boolean> {
    if (scope === "platform") {
      const roles = await this.platformQueries.getActiveUserRoles(ctx.userId);
      return roles.some((r) => r.role_id === roleKey);
    } else {
      if (!ctx.tenantId) return false;
      const roles = await this.tenantQueries.getActiveUserRoles(ctx.tenantId, ctx.userId);
      return roles.some((r) => r.role_id === roleKey);
    }
  }
}
