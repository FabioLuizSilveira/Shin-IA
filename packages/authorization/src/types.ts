// Authorization Runtime Types

export type AuthorizationScope = "platform" | "tenant";

export type SessionTrustLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export interface AuthorizationContext {
  userId: string;
  tenantId: string | null;
  platformRole: string | null;
  tenantRole: string | null;
  branchIds: string[];
  capabilities: string[];
  sessionTrustLevel: SessionTrustLevel;
  mfaVerified: boolean;
  isImpersonating: boolean;
}

export interface PermissionCheckRequest {
  ctx: AuthorizationContext;
  permission: string;
  scope: AuthorizationScope;
  resource?: ResourceContext;
}

export interface ResourceContext {
  tenantId?: string;
  branchId?: string;
  blueprintId?: string;
  assetId?: string;
  ownerId?: string;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason: string;
  requiresMfa?: boolean;
  requiresApproval?: boolean;
}

export interface AbacPolicy {
  name: string;
  evaluate(ctx: AuthorizationContext, resource: ResourceContext): boolean;
}

export type BranchScopeMode = "root" | "branch_and_children" | "branch" | "custom";

export interface BranchScope {
  mode: BranchScopeMode;
  branchId?: string;
  branchIds?: string[];
}
