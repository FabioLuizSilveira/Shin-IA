// Delegated Access Request Entity
// Represents a time-bounded permission delegation

import type { DelegatedAccessRequestRow, DelegatedAccessStatus } from "../types.js";

export class DelegatedAccessRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly grantorId: string;
  readonly granteeId: string;
  readonly permissions: string[];
  readonly branchIds: string[];
  readonly reason: string | null;
  readonly status: DelegatedAccessStatus;
  readonly grantedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly revokedBy: string | null;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(data: DelegatedAccessRequestRow) {
    this.id = data.id;
    this.tenantId = data.tenant_id;
    this.grantorId = data.grantor_id;
    this.granteeId = data.grantee_id;
    this.permissions = data.permissions;
    this.branchIds = data.branch_ids;
    this.reason = data.reason;
    this.status = data.status;
    this.grantedAt = new Date(data.granted_at);
    this.expiresAt = new Date(data.expires_at);
    this.revokedAt = data.revoked_at ? new Date(data.revoked_at) : null;
    this.revokedBy = data.revoked_by;
    this.version = data.version;
    this.metadata = data.metadata;
    this.createdAt = new Date(data.created_at);
    this.updatedAt = new Date(data.updated_at);
    this.deletedAt = data.deleted_at ? new Date(data.deleted_at) : null;
  }

  isActive(): boolean {
    return this.status === "active" && !this.isExpired();
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isRevoked(): boolean {
    return this.status === "revoked";
  }

  toRow(): DelegatedAccessRequestRow {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      grantor_id: this.grantorId,
      grantee_id: this.granteeId,
      permissions: this.permissions,
      branch_ids: this.branchIds,
      reason: this.reason,
      status: this.status,
      granted_at: this.grantedAt.toISOString(),
      expires_at: this.expiresAt.toISOString(),
      revoked_at: this.revokedAt?.toISOString() || null,
      revoked_by: this.revokedBy,
      version: this.version,
      metadata: this.metadata,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
      deleted_at: this.deletedAt?.toISOString() || null,
    };
  }
}
