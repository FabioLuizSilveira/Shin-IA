import type { AuthorizationContext, ResourceContext, BranchScope } from "../types.js";

export class ScopeEvaluator {
  // Branch Scope: validates the user can operate on the resource's branch
  evaluateBranchScope(
    ctx: AuthorizationContext,
    resource: ResourceContext,
    scope: BranchScope,
  ): boolean {
    if (!resource.branchId) return true; // No branch restriction = global

    switch (scope.mode) {
      case "root":
        // Root scope can access any branch
        return true;

      case "branch_and_children":
        // User can access the assigned branch and all its children
        return (
          ctx.branchIds.includes(resource.branchId) ||
          ctx.branchIds.some((id) => resource.branchId?.startsWith(id))
        );

      case "branch":
        // User can only access exactly the assigned branch
        return ctx.branchIds.includes(resource.branchId);

      case "custom":
        // User can access a custom set of branches
        if (!scope.branchIds) return false;
        return scope.branchIds.includes(resource.branchId);

      default:
        return false;
    }
  }

  // Capability Scope: validates the user has the required capability
  evaluateCapabilityScope(ctx: AuthorizationContext, requiredCapability: string): boolean {
    return ctx.capabilities.includes(requiredCapability);
  }

  // Blueprint Scope: validates access to a blueprint resource
  evaluateBlueprintScope(ctx: AuthorizationContext, resource: ResourceContext): boolean {
    if (!resource.blueprintId) return true;
    // Blueprints are tenant-scoped; tenant membership is validated by RBAC
    return ctx.tenantId !== null;
  }

  // Asset Scope: validates access to an asset resource
  evaluateAssetScope(ctx: AuthorizationContext, resource: ResourceContext): boolean {
    if (!resource.assetId) return true;
    // Assets require branch scope + asset-related capability
    return this.evaluateCapabilityScope(ctx, "assets.read");
  }

  // Tenant Scope: validates user is operating within their tenant
  evaluateTenantScope(ctx: AuthorizationContext, resource: ResourceContext): boolean {
    if (!resource.tenantId) return true; // No tenant restriction
    return ctx.tenantId === resource.tenantId;
  }
}
