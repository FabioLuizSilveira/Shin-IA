import { PlatformRole } from "@shina/iam-domain";
import type { PlatformRoleRow } from "@shina/iam-domain";

export class PlatformRoleMapper {
  static toDomain(row: PlatformRoleRow): PlatformRole {
    return new PlatformRole(row);
  }

  static toRow(entity: PlatformRole): PlatformRoleRow {
    return entity.toRow();
  }

  static toDomainList(rows: PlatformRoleRow[]): PlatformRole[] {
    return rows.map((row) => this.toDomain(row));
  }
}
