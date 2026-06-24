import { ApprovalRequest } from "@shina/iam-domain";
import type { ApprovalRequestRow } from "@shina/iam-domain";
import { ApprovalRequestMapper } from "../mappers/index.js";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class ApprovalRequestRepository extends BaseRepository<ApprovalRequest, ApprovalRequestRow> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "approval_requests";
  }

  toDomain(row: ApprovalRequestRow): ApprovalRequest {
    return ApprovalRequestMapper.toDomain(row);
  }

  toRow(entity: ApprovalRequest): ApprovalRequestRow {
    return ApprovalRequestMapper.toRow(entity);
  }

  async findPendingByWorkflow(workflowType: string): Promise<ApprovalRequest[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("workflow_type", workflowType)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return ApprovalRequestMapper.toDomainList(data as ApprovalRequestRow[]);
  }

  async findBySubject(subjectType: string, subjectId: string): Promise<ApprovalRequest[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return ApprovalRequestMapper.toDomainList(data as ApprovalRequestRow[]);
  }

  async findByTenant(tenantId: string): Promise<ApprovalRequest[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return ApprovalRequestMapper.toDomainList(data as ApprovalRequestRow[]);
  }

  async findExpired(): Promise<ApprovalRequest[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("status", "pending")
      .lt("expires_at", now)
      .is("deleted_at", null);

    if (error || !data) return [];
    return ApprovalRequestMapper.toDomainList(data as ApprovalRequestRow[]);
  }
}
