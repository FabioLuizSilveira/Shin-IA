// Tenant Role Entity
// Represents a role within a tenant (system or custom)

import type { TenantRoleRow } from "../types.js";

export class TenantRole {
  readonly id: string;
  readonly tenantId: string;
  readonly key: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly isSystem: boolean;
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  constructor(data: TenantRoleRow) {
    this.id = data.id;
    this.tenantId = data.tenant_id;
    this.key = data.key;
    this.name = data.name;
    this.description = data.description;
    this.isSystem = data.is_system;
    this.version = data.version;
    this.metadata = data.metadata;
    this.createdAt = new Date(data.created_at);
    this.updatedAt = new Date(data.updated_at);
    this.deletedAt = data.deleted_at ? new Date(data.deleted_at) : null;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  isActive(): boolean {
    return !this.isDeleted();
  }

  isSystemRole(): boolean {
    return this.isSystem && this.key !== null;
  }

  isCustomRole(): boolean {
    return !this.isSystem;
  }

  toRow(): TenantRoleRow {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      key: this.key,
      name: this.name,
      description: this.description,
      is_system: this.isSystem,
      version: this.version,
      metadata: this.metadata,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
      deleted_at: this.deletedAt?.toISOString() || null,
    };
  }
}
