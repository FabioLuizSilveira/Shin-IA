import { DelegatedAccessRequest } from "@shina/iam-domain";
import type { DelegatedAccessRequestRow } from "@shina/iam-domain";

export class DelegatedAccessMapper {
  static toDomain(row: DelegatedAccessRequestRow): DelegatedAccessRequest {
    return new DelegatedAccessRequest(row);
  }

  static toRow(entity: DelegatedAccessRequest): DelegatedAccessRequestRow {
    return entity.toRow();
  }

  static toDomainList(rows: DelegatedAccessRequestRow[]): DelegatedAccessRequest[] {
    return rows.map((row) => this.toDomain(row));
  }
}
