import type { ApprovalStepRow } from "@shina/iam-domain";
import { BaseRepository, type BaseRepositoryDeps } from "./base.repository.js";

export class ApprovalStepRepository extends BaseRepository<ApprovalStepRow, ApprovalStepRow> {
  constructor(deps: BaseRepositoryDeps) {
    super(deps);
  }

  getTableName(): string {
    return "approval_steps";
  }

  toDomain(row: ApprovalStepRow): ApprovalStepRow {
    return row;
  }

  toRow(entity: ApprovalStepRow): ApprovalStepRow {
    return entity;
  }

  async findByApprovalRequestId(approvalRequestId: string): Promise<ApprovalStepRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("approval_request_id", approvalRequestId)
      .is("deleted_at", null)
      .order("step_index", { ascending: true });

    if (error || !data) return [];
    return data as ApprovalStepRow[];
  }

  async findPendingSteps(approvalRequestId: string): Promise<ApprovalStepRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("approval_request_id", approvalRequestId)
      .is("approval_at", null)
      .is("deleted_at", null)
      .order("step_index", { ascending: true });

    if (error || !data) return [];
    return data as ApprovalStepRow[];
  }

  async findByActor(actorId: string): Promise<ApprovalStepRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("actor_id", actorId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as ApprovalStepRow[];
  }

  async findPendingForActor(actorId: string): Promise<ApprovalStepRow[]> {
    const { data, error } = await this.db
      .from(this.getTableName())
      .select("*")
      .eq("actor_id", actorId)
      .is("approval_at", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data as ApprovalStepRow[];
  }
}
