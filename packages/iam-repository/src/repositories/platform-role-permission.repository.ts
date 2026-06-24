import type { PlatformRolePermissionRow } from "@shina/iam-domain";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class PlatformRolePermissionRepository extends BaseRepository<
  PlatformRolePermissionRow,
  PlatformRolePermissionRow
> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "platform_role_permissions";
  }

  toDomain(row: PlatformRolePermissionRow): PlatformRolePermissionRow {
    return row;
  }

  toRow(entity: PlatformRolePermissionRow): PlatformRolePermissionRow {
    return entity;
  }

  async findByRoleId(roleId: string): Promise<PlatformRolePermissionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("role_id", roleId);

    if (error || !data) return [];
    return data as PlatformRolePermissionRow[];
  }

  async findByPermissionId(permissionId: string): Promise<PlatformRolePermissionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("permission_id", permissionId);

    if (error || !data) return [];
    return data as PlatformRolePermissionRow[];
  }

  async deleteByRoleId(roleId: string): Promise<void> {
    const { error } = await this.db.from(this.getTableName()).delete().eq("role_id", roleId);

    if (error) throw error;
  }
}
