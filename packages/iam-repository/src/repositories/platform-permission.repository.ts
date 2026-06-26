import type { PlatformPermissionRow } from "@shina/iam-domain";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class PlatformPermissionRepository extends BaseRepository<
  PlatformPermissionRow,
  PlatformPermissionRow
> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "platform_permissions";
  }

  toDomain(row: PlatformPermissionRow): PlatformPermissionRow {
    return row;
  }

  toRow(entity: PlatformPermissionRow): PlatformPermissionRow {
    return entity;
  }

  async findByKey(key: string): Promise<PlatformPermissionRow | null> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("key", key)
      .is("deleted_at", null)
      .single();

    if (error || !data) return null;
    return data as PlatformPermissionRow;
  }

  async findByCategory(category: string): Promise<PlatformPermissionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("category", category)
      .is("deleted_at", null)
      .order("key");

    if (error || !data) return [];
    return data as PlatformPermissionRow[];
  }
}
