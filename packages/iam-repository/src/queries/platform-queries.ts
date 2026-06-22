import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformRoleRow, PlatformPermissionRow } from "@shina/iam-domain";
import {
  PlatformRoleRepository,
  PlatformPermissionRepository,
  PlatformRolePermissionRepository,
  PlatformUserRoleRepository,
} from "../repositories/index.js";

export interface PlatformQueriesDeps {
  db: SupabaseClient;
}

export class PlatformQueries {
  private roleRepo: PlatformRoleRepository;
  private permissionRepo: PlatformPermissionRepository;
  private rolePermissionRepo: PlatformRolePermissionRepository;
  private userRoleRepo: PlatformUserRoleRepository;

  constructor(deps: PlatformQueriesDeps) {
    this.roleRepo = new PlatformRoleRepository({ db: deps.db });
    this.permissionRepo = new PlatformPermissionRepository({ db: deps.db });
    this.rolePermissionRepo = new PlatformRolePermissionRepository({ db: deps.db });
    this.userRoleRepo = new PlatformUserRoleRepository({ db: deps.db });
  }

  async getUserRoles(userId: string) {
    return this.userRoleRepo.findByUserId(userId);
  }

  async getActiveUserRoles(userId: string) {
    return this.userRoleRepo.findActiveByUserId(userId);
  }

  async getUserPermissions(userId: string): Promise<PlatformPermissionRow[]> {
    const userRoles = await this.getActiveUserRoles(userId);
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
      .from("platform_permissions")
      .select("*")
      .in("id", permissionIds)
      .is("deleted_at", null);

    if (error || !data) return [];
    return data as PlatformPermissionRow[];
  }

  async grantRoleToUser(userId: string, roleId: string, expiresAt?: Date) {
    return this.userRoleRepo.create({
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
      user_id: userId,
      role_id: roleId,
      expires_at: expiresAt?.toISOString() || null,
      version: 1,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    } as any);
  }

  async revokeRoleFromUser(userId: string, roleId: string) {
    return this.userRoleRepo.deleteByUserAndRole(userId, roleId);
  }

  async hasPermission(userId: string, permissionKey: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.some((p) => p.key === permissionKey);
  }
}
