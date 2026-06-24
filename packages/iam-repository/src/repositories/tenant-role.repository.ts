import { TenantRole } from "@shina/iam-domain";
import type { TenantRoleRow } from "@shina/iam-domain";
import { TenantRoleMapper } from "../mappers/index.js";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class TenantRoleRepository extends BaseRepository<TenantRole, TenantRoleRow> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "tenant_roles";
  }

  toDomain(row: TenantRoleRow): TenantRole {
    return TenantRoleMapper.toDomain(row);
  }

  toRow(entity: TenantRole): TenantRoleRow {
    return TenantRoleMapper.toRow(entity);
  }

  async findByTenantId(tenantId: string): Promise<TenantRole[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("name");

    if (error || !data) return [];
    return TenantRoleMapper.toDomainList(data as TenantRoleRow[]);
  }

  async findByTenantAndKey(tenantId: string, key: string): Promise<TenantRole | null> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("key", key)
      .is("deleted_at", null)
      .single();

    if (error || !data) return null;
    return this.toDomain(data as TenantRoleRow);
  }

  async findSystemRolesByTenant(tenantId: string): Promise<TenantRole[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_system", true)
      .is("deleted_at", null)
      .order("name");

    if (error || !data) return [];
    return TenantRoleMapper.toDomainList(data as TenantRoleRow[]);
  }

  async findCustomRolesByTenant(tenantId: string): Promise<TenantRole[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_system", false)
      .is("deleted_at", null)
      .order("name");

    if (error || !data) return [];
    return TenantRoleMapper.toDomainList(data as TenantRoleRow[]);
  }
}
