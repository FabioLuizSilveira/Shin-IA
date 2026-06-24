import type { TenantUserRoleRow } from "@shina/iam-domain";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class TenantUserRoleRepository extends BaseRepository<TenantUserRoleRow, TenantUserRoleRow> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "tenant_user_roles";
  }

  toDomain(row: TenantUserRoleRow): TenantUserRoleRow {
    return row;
  }

  toRow(entity: TenantUserRoleRow): TenantUserRoleRow {
    return entity;
  }

  async findByTenantAndUser(tenantId: string, userId: string): Promise<TenantUserRoleRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error || !data) return [];
    return data as TenantUserRoleRow[];
  }

  async findActiveByTenantAndUser(tenantId: string, userId: string): Promise<TenantUserRoleRow[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (error || !data) return [];
    return data as TenantUserRoleRow[];
  }

  async findByTenantAndRole(tenantId: string, roleId: string): Promise<TenantUserRoleRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("role_id", roleId)
      .is("deleted_at", null);

    if (error || !data) return [];
    return data as TenantUserRoleRow[];
  }

  async findByBranch(branchId: string): Promise<TenantUserRoleRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("branch_id", branchId)
      .is("deleted_at", null);

    if (error || !data) return [];
    return data as TenantUserRoleRow[];
  }

  async deleteByTenantUserAndRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    const { error } = await this.db
      .from(this.getTableName())
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("role_id", roleId);

    if (error) throw error;
  }
}
