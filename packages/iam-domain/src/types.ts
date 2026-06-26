// IAM Domain Types
// Database table row types and enums

export type PermissionScope = "platform" | "tenant";

export type UserRoleStatus = "active" | "expired" | "inactive";

export type DelegatedAccessStatus = "active" | "revoked" | "expired";

export type ImpersonationAccessMode = "full" | "read_only";

export type ImpersonationSessionStatus = "active" | "revoked" | "expired";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

export type ApprovalStepType = "approval" | "notification" | "action";

export type ApprovalStepStatus = "pending" | "approved" | "rejected" | "skipped";

// ============================================================================
// Platform IAM Types
// ============================================================================

export type PlatformRoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string; // ISO timestamp
  updated_at: string;
  deleted_at: string | null;
};

export type PlatformPermissionRow = {
  id: string;
  key: string;
  resource: string;
  action: string;
  name: string;
  description: string | null;
  is_system: boolean;
  scope: PermissionScope;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PlatformRolePermissionRow = {
  role_id: string;
  permission_id: string;
  created_at: string;
};

export type PlatformUserRoleRow = {
  id: string;
  user_id: string;
  role_id: string;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// ============================================================================
// Tenant IAM Types
// ============================================================================

export type TenantRoleRow = {
  id: string;
  tenant_id: string;
  key: string | null;
  name: string;
  description: string | null;
  is_system: boolean;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TenantPermissionRow = {
  id: string;
  key: string;
  resource: string;
  action: string;
  name: string;
  description: string | null;
  is_system: boolean;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TenantRolePermissionRow = {
  role_id: string;
  permission_id: string;
  created_at: string;
};

export type BranchScopeMode = "root" | "branch_and_children" | "branch" | "custom";

export type TenantUserRoleRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  role_id: string;
  branch_scope_mode: BranchScopeMode | null;
  branch_id: string | null;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// ============================================================================
// Delegated Access Types
// ============================================================================

export type DelegatedAccessRequestRow = {
  id: string;
  tenant_id: string;
  grantor_id: string;
  grantee_id: string;
  permissions: string[];
  branch_ids: string[];
  reason: string | null;
  status: DelegatedAccessStatus;
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// ============================================================================
// Impersonation Types
// ============================================================================

export type ImpersonationSessionRow = {
  id: string;
  tenant_id: string;
  platform_actor_id: string;
  target_user_id: string;
  target_tenant_id: string;
  reason: string;
  access_mode: ImpersonationAccessMode;
  secondary_auth_by: string | null;
  status: ImpersonationSessionStatus;
  started_at: string;
  ended_at: string | null;
  max_duration_minutes: number | null;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// ============================================================================
// Approval Workflow Types
// ============================================================================

export type ApprovalRequestRow = {
  id: string;
  tenant_id: string | null;
  workflow_type: string;
  subject_type: string;
  subject_id: string;
  submitted_by: string;
  status: ApprovalStatus;
  reason: string | null;
  rejection_reason: string | null;
  expires_at: string;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ApprovalStepRow = {
  id: string;
  approval_request_id: string;
  step_number: number;
  step_type: ApprovalStepType;
  required_role: string | null;
  required_user_id: string | null;
  status: ApprovalStepStatus;
  acted_by_id: string | null;
  acted_at: string | null;
  comment: string | null;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
