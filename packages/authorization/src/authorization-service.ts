import type { PermissionEvaluator } from "./rbac/permission-evaluator.js";
import type { RoleResolver } from "./rbac/role-resolver.js";
import { ScopeEvaluator } from "./abac/scope-evaluator.js";
import type {
  AuthorizationContext,
  AuthorizationScope,
  AuthorizationResult,
  ResourceContext,
  BranchScope,
} from "./types.js";

export interface AuthorizationServiceDeps {
  permissionEvaluator: PermissionEvaluator;
  roleResolver: RoleResolver;
}

export class AuthorizationService {
  private permissionEvaluator: PermissionEvaluator;
  private roleResolver: RoleResolver;
  private scopeEvaluator: ScopeEvaluator;

  constructor(deps: AuthorizationServiceDeps) {
    this.permissionEvaluator = deps.permissionEvaluator;
    this.roleResolver = deps.roleResolver;
    this.scopeEvaluator = new ScopeEvaluator();
  }

  // Primary authorization check: RBAC + ABAC
  async authorize(
    ctx: AuthorizationContext,
    permission: string,
    scope: AuthorizationScope,
    resource?: ResourceContext,
  ): Promise<AuthorizationResult> {
    // Layer 1: RBAC — Does the user's role include the required permission?
    const rbacResult = await this.permissionEvaluator.evaluate(ctx, permission, scope);
    if (!rbacResult.allowed) return rbacResult;

    // Layer 2: ABAC — Do the request attributes satisfy all active policies?
    if (resource) {
      const abacResult = this.evaluateAbac(ctx, resource);
      if (!abacResult.allowed) return abacResult;
    }

    // Layer 3: Approval Gate (signals to caller — not enforced here)
    return rbacResult;
  }

  private evaluateAbac(ctx: AuthorizationContext, resource: ResourceContext): AuthorizationResult {
    // Tenant scope check
    if (!this.scopeEvaluator.evaluateTenantScope(ctx, resource)) {
      return {
        allowed: false,
        reason: "Resource belongs to a different tenant",
      };
    }

    // Blueprint scope check
    if (!this.scopeEvaluator.evaluateBlueprintScope(ctx, resource)) {
      return {
        allowed: false,
        reason: "User does not have access to this blueprint",
      };
    }

    // Asset scope check
    if (resource.assetId && !this.scopeEvaluator.evaluateAssetScope(ctx, resource)) {
      return {
        allowed: false,
        reason: "User does not have access to this asset",
      };
    }

    return { allowed: true, reason: "ABAC policies satisfied" };
  }

  // Convenience: check branch scope separately
  evaluateBranchScope(
    ctx: AuthorizationContext,
    resource: ResourceContext,
    branchScope: BranchScope,
  ): boolean {
    return this.scopeEvaluator.evaluateBranchScope(ctx, resource, branchScope);
  }

  // Convenience: check capability scope
  hasCapability(ctx: AuthorizationContext, capability: string): boolean {
    return this.scopeEvaluator.evaluateCapabilityScope(ctx, capability);
  }

  // Resolve all effective roles/permissions for a user
  async resolveUserRoles(ctx: AuthorizationContext) {
    return this.roleResolver.resolve(ctx);
  }

  // Build a minimal context from JWT claims
  static buildContext(
    userId: string,
    tenantId: string | null,
    platformRole: string | null,
    tenantRole: string | null,
    branchIds: string[],
    capabilities: string[],
    opts: {
      sessionTrustLevel?: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
      mfaVerified?: boolean;
      isImpersonating?: boolean;
    } = {},
  ): AuthorizationContext {
    return {
      userId,
      tenantId,
      platformRole,
      tenantRole,
      branchIds,
      capabilities,
      sessionTrustLevel: opts.sessionTrustLevel ?? "MEDIUM",
      mfaVerified: opts.mfaVerified ?? false,
      isImpersonating: opts.isImpersonating ?? false,
    };
  }
}
