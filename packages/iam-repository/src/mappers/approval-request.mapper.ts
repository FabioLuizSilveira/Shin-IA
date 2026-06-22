import { ApprovalRequest } from "@shina/iam-domain";
import type { ApprovalRequestRow } from "@shina/iam-domain";

export class ApprovalRequestMapper {
  static toDomain(row: ApprovalRequestRow): ApprovalRequest {
    return new ApprovalRequest(row);
  }

  static toRow(entity: ApprovalRequest): ApprovalRequestRow {
    return entity.toRow();
  }

  static toDomainList(rows: ApprovalRequestRow[]): ApprovalRequest[] {
    return rows.map((row) => this.toDomain(row));
  }
}
