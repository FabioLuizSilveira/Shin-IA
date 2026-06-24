import type { PlatformUserRoleRow } from "@shina/iam-domain";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class PlatformUserRoleRepository extends BaseRepository<
  PlatformUserRoleRow,
  PlatformUserRoleRow
> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "platform_user_roles";
  }

  toDomain(row: PlatformUserRoleRow): PlatformUserRoleRow {
    return row;
  }

  toRow(entity: PlatformUserRoleRow): PlatformUserRoleRow {
    return entity;
  }

  async findByUserId(userId: string): Promise<PlatformUserRoleRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .is("expires_at", null);

    if (error || !data) return [];
    return data as PlatformUserRoleRow[];
  }

  async findByRoleId(roleId: string): Promise<PlatformUserRoleRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("role_id", roleId)
      .is("deleted_at", null);

    if (error || !data) return [];
    return data as PlatformUserRoleRow[];
  }

  async findActiveByUserId(userId: string): Promise<PlatformUserRoleRow[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (error || !data) return [];
    return data as PlatformUserRoleRow[];
  }

  async deleteByUserAndRole(userId: string, roleId: string): Promise<void> {
    const { error } = await this.db
      .from(this.getTableName())
      .delete()
      .eq("user_id", userId)
      .eq("role_id", roleId);

    if (error) throw error;
  }
}
