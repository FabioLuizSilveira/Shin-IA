import type { ImpersonationSessionRow } from "@shina/iam-domain";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class ImpersonationSessionRepository extends BaseRepository<
  ImpersonationSessionRow,
  ImpersonationSessionRow
> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "impersonation_sessions";
  }

  toDomain(row: ImpersonationSessionRow): ImpersonationSessionRow {
    return row;
  }

  toRow(entity: ImpersonationSessionRow): ImpersonationSessionRow {
    return entity;
  }

  async findByTenant(tenantId: string): Promise<ImpersonationSessionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("session_start", { ascending: false });

    if (error || !data) return [];
    return data as ImpersonationSessionRow[];
  }

  async findActiveByOperator(platformOperatorId: string): Promise<ImpersonationSessionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("platform_operator_id", platformOperatorId)
      .is("session_end", null)
      .is("deleted_at", null);

    if (error || !data) return [];
    return data as ImpersonationSessionRow[];
  }

  async findByImpersonatedUser(
    tenantId: string,
    userId: string,
  ): Promise<ImpersonationSessionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("impersonated_user_id", userId)
      .is("deleted_at", null)
      .order("session_start", { ascending: false });

    if (error || !data) return [];
    return data as ImpersonationSessionRow[];
  }

  async findOngoing(): Promise<ImpersonationSessionRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .is("session_end", null)
      .is("deleted_at", null);

    if (error || !data) return [];
    return data as ImpersonationSessionRow[];
  }
}
