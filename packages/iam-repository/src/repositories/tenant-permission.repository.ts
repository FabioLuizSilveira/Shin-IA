import type { TenantPermissionRow } from "@shina/iam-domain";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class TenantPermissionRepository extends BaseRepository<
  TenantPermissionRow,
  TenantPermissionRow
> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "tenant_permissions";
  }

  toDomain(row: TenantPermissionRow): TenantPermissionRow {
    return row;
  }

  toRow(entity: TenantPermissionRow): TenantPermissionRow {
    return entity;
  }

  async findByKey(key: string): Promise<TenantPermissionRow | null> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("key", key)
      .is("deleted_at", null)
      .single();

    if (error || !data) return null;
    return data as TenantPermissionRow;
  }

  async findByCategory(category: string): Promise<TenantPermissionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("category", category)
      .is("deleted_at", null)
      .order("key");

    if (error || !data) return [];
    return data as TenantPermissionRow[];
  }

  async findByScope(scope: "platform" | "tenant"): Promise<TenantPermissionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("scope", scope)
      .is("deleted_at", null)
      .order("key");

    if (error || !data) return [];
    return data as TenantPermissionRow[];
  }
}
