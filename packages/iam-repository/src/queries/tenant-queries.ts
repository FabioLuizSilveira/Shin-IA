import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantPermissionRow } from "@shina/iam-domain";
import {
  TenantRoleRepository,
  TenantRolePermissionRepository,
  TenantUserRoleRepository,
} from "../repositories/index.js";

export interface TenantQueriesDeps {
  db: SupabaseClient;
}

export class TenantQueries {
  private roleRepo: TenantRoleRepository;
  private rolePermissionRepo: TenantRolePermissionRepository;
  private userRoleRepo: TenantUserRoleRepository;

  constructor(deps: TenantQueriesDeps) {
    this.roleRepo = new TenantRoleRepository({ db: deps.db });
    this.rolePermissionRepo = new TenantRolePermissionRepository({ db: deps.db });
    this.userRoleRepo = new TenantUserRoleRepository({ db: deps.db });
  }

  async getUserRoles(tenantId: string, userId: string) {
    return this.userRoleRepo.findByTenantAndUser(tenantId, userId);
  }

  async getActiveUserRoles(tenantId: string, userId: string) {
    return this.userRoleRepo.findActiveByTenantAndUser(tenantId, userId);
  }

  async getUserPermissions(tenantId: string, userId: string): Promise<TenantPermissionRow[]> {
    const userRoles = await this.getActiveUserRoles(tenantId, userId);
    if (userRoles.length === 0) return [];

    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      const rolePermissions = await this.rolePermissionRepo.findByRoleId(userRole.role_id);
      for (const rp of rolePermissions) {
        permissions.add(rp.permission_id);
      }
    }

    const permissionIds = Array.from(permissions);
    if (permissionIds.length === 0) return [];

    const { data, error } = await this.roleRepo.db
      .from("tenant_permissions")
      .select("*")
      .in("id", permissionIds)
      .is("deleted_at", null);

    if (error || !data) return [];
    return data as TenantPermissionRow[];
  }

  async grantRoleToUser(
    tenantId: string,
    userId: string,
    roleId: string,
    expiresAt?: Date,
    branchId?: string,
  ) {
    return this.userRoleRepo.create({
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
      tenant_id: tenantId,
      user_id: userId,
      role_id: roleId,
      branch_scope_mode: branchId ? "branch" : "root",
      branch_id: branchId || null,
      granted_by: null,
      granted_at: new Date().toISOString(),
      expires_at: expiresAt?.toISOString() || null,
      version: 1,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    } as any);
  }

  async revokeRoleFromUser(tenantId: string, userId: string, roleId: string) {
    return this.userRoleRepo.deleteByTenantUserAndRole(tenantId, userId, roleId);
  }

  async hasPermission(tenantId: string, userId: string, permissionKey: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(tenantId, userId);
    return permissions.some((p) => p.key === permissionKey);
  }

  async getUserRolesByBranch(branchId: string) {
    return this.userRoleRepo.findByBranch(branchId);
  }
}
