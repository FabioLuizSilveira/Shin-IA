import { DelegatedAccessRequest } from "@shina/iam-domain";
import type { DelegatedAccessRequestRow } from "@shina/iam-domain";
import { DelegatedAccessMapper } from "../mappers/index.js";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class DelegatedAccessRepository extends BaseRepository<
  DelegatedAccessRequest,
  DelegatedAccessRequestRow
> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "delegated_access_requests";
  }

  toDomain(row: DelegatedAccessRequestRow): DelegatedAccessRequest {
    return DelegatedAccessMapper.toDomain(row);
  }

  toRow(entity: DelegatedAccessRequest): DelegatedAccessRequestRow {
    return DelegatedAccessMapper.toRow(entity);
  }

  async findByGrantee(tenantId: string, granteeId: string): Promise<DelegatedAccessRequest[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("grantee_id", granteeId)
      .is("deleted_at", null);

    if (error || !data) return [];
    return DelegatedAccessMapper.toDomainList(data as DelegatedAccessRequestRow[]);
  }

  async findActiveByGrantee(
    tenantId: string,
    granteeId: string,
  ): Promise<DelegatedAccessRequest[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("grantee_id", granteeId)
      .eq("status", "active")
      .is("deleted_at", null)
      .gt("expires_at", now);

    if (error || !data) return [];
    return DelegatedAccessMapper.toDomainList(data as DelegatedAccessRequestRow[]);
  }

  async findByGrantor(tenantId: string, grantorId: string): Promise<DelegatedAccessRequest[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("grantor_id", grantorId)
      .is("deleted_at", null);

    if (error || !data) return [];
    return DelegatedAccessMapper.toDomainList(data as DelegatedAccessRequestRow[]);
  }

  async findExpiredAndActive(): Promise<DelegatedAccessRequest[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("status", "active")
      .lt("expires_at", now)
      .is("deleted_at", null);

    if (error || !data) return [];
    return DelegatedAccessMapper.toDomainList(data as DelegatedAccessRequestRow[]);
  }
}
