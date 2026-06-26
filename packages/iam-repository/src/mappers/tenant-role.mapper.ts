import { TenantRole } from "@shina/iam-domain";
import type { TenantRoleRow } from "@shina/iam-domain";

export class TenantRoleMapper {
  static toDomain(row: TenantRoleRow): TenantRole {
    return new TenantRole(row);
  }

  static toRow(entity: TenantRole): TenantRoleRow {
    return entity.toRow();
  }

  static toDomainList(rows: TenantRoleRow[]): TenantRole[] {
    return rows.map((row) => this.toDomain(row));
  }
}
