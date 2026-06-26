// Tenant Context Resolver
// Identifies and validates tenant context from JWT claims

import type { JWTClaims, TenantContext } from "./types.js";

export class TenantContextResolver {
  // Extract tenant context from JWT claims
  resolveTenantContext(claims: JWTClaims): TenantContext {
    if (!claims.tenant_id) {
      throw new Error("Invalid JWT: missing tenant_id claim");
    }

    return {
      tenantId: claims.tenant_id,
      userId: claims.sub,
      platformRole: claims.platform_role,
      tenantRole: claims.tenant_role,
      branchIds: claims.branch_ids || [],
      capabilities: claims.capabilities || [],
    };
  }

  // Validate tenant context consistency
  validateTenantContext(context: TenantContext): boolean {
    if (!context.tenantId || !context.userId) {
      return false;
    }

    // Basic validation: branch IDs should be UUIDs
    if (context.branchIds.some((id) => !this.isValidUUID(id))) {
      return false;
    }

    return true;
  }

  // Validate tenant ID matches expected value
  validateTenantId(context: TenantContext, expectedTenantId: string): boolean {
    return context.tenantId === expectedTenantId;
  }

  // Check if user has capability
  hasCapability(context: TenantContext, capability: string): boolean {
    return context.capabilities.includes(capability);
  }

  // Get branch scope from context
  getBranchScope(context: TenantContext): string[] {
    return context.branchIds;
  }

  // Private helper
  private isValidUUID(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}
