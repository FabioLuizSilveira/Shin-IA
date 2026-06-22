import type { TenantRolePermissionRow } from "@shina/iam-domain";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class TenantRolePermissionRepository extends BaseRepository<
  TenantRolePermissionRow,
  TenantRolePermissionRow
> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "tenant_role_permissions";
  }

  toDomain(row: TenantRolePermissionRow): TenantRolePermissionRow {
    return row;
  }

  toRow(entity: TenantRolePermissionRow): TenantRolePermissionRow {
    return entity;
  }

  async findByRoleId(roleId: string): Promise<TenantRolePermissionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("role_id", roleId);

    if (error || !data) return [];
    return data as TenantRolePermissionRow[];
  }

  async findByPermissionId(permissionId: string): Promise<TenantRolePermissionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("permission_id", permissionId);

    if (error || !data) return [];
    return data as TenantRolePermissionRow[];
  }

  async deleteByRoleId(roleId: string): Promise<void> {
    const { error } = await this.db.from(this.getTableName()).delete().eq("role_id", roleId);

    if (error) throw error;
  }
}
