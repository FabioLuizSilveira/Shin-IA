import { PlatformRole } from "@shina/iam-domain";
import type { PlatformRoleRow } from "@shina/iam-domain";
import { PlatformRoleMapper } from "../mappers/index.js";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class PlatformRoleRepository extends BaseRepository<PlatformRole, PlatformRoleRow> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "platform_roles";
  }

  toDomain(row: PlatformRoleRow): PlatformRole {
    return PlatformRoleMapper.toDomain(row);
  }

  toRow(entity: PlatformRole): PlatformRoleRow {
    return PlatformRoleMapper.toRow(entity);
  }

  async findByKey(key: string): Promise<PlatformRole | null> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("key", key)
      .is("deleted_at", null)
      .single();

    if (error || !data) return null;
    return this.toDomain(data as PlatformRoleRow);
  }

  async findSystemRoles(): Promise<PlatformRole[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("is_system", true)
      .is("deleted_at", null)
      .order("name");

    if (error || !data) return [];
    return PlatformRoleMapper.toDomainList(data as PlatformRoleRow[]);
  }
}
