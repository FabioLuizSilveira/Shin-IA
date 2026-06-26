// Approval Request Entity
// Represents a workflow instance that requires approvals

import type { ApprovalRequestRow, ApprovalStatus } from "../types.js";

export class ApprovalRequest {
  readonly id: string;
  readonly tenantId: string | null;
  readonly workflowType: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly submittedBy: string;
  readonly status: ApprovalStatus;
  readonly reason: string | null;
  readonly rejectionReason: string | null;
  readonly expiresAt: Date;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(data: ApprovalRequestRow) {
    this.id = data.id;
    this.tenantId = data.tenant_id;
    this.workflowType = data.workflow_type;
    this.subjectType = data.subject_type;
    this.subjectId = data.subject_id;
    this.submittedBy = data.submitted_by;
    this.status = data.status;
    this.reason = data.reason;
    this.rejectionReason = data.rejection_reason;
    this.expiresAt = new Date(data.expires_at);
    this.version = data.version;
    this.metadata = data.metadata;
    this.createdAt = new Date(data.created_at);
    this.updatedAt = new Date(data.updated_at);
    this.deletedAt = data.deleted_at ? new Date(data.deleted_at) : null;
  }

  isPending(): boolean {
    return this.status === "pending" && !this.isExpired();
  }

  isApproved(): boolean {
    return this.status === "approved";
  }

  isRejected(): boolean {
    return this.status === "rejected";
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt && this.status !== "approved" && this.status !== "rejected";
  }

  isFinal(): boolean {
    return this.status === "approved" || this.status === "rejected" || this.isExpired();
  }

  toRow(): ApprovalRequestRow {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      workflow_type: this.workflowType,
      subject_type: this.subjectType,
      subject_id: this.subjectId,
      submitted_by: this.submittedBy,
      status: this.status,
      reason: this.reason,
      rejection_reason: this.rejectionReason,
      expires_at: this.expiresAt.toISOString(),
      version: this.version,
      metadata: this.metadata,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
      deleted_at: this.deletedAt?.toISOString() || null,
    };
  }
}
