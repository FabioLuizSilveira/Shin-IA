import type { AuditEntry, AuditEventType } from "./types.js";
import { SecurityError } from "./iam.js";

function simpleHash(data: string): string {
  let h = 0;
  for (let i = 0; i < data.length; i++) {
    h = (Math.imul(31, h) + data.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

export class AuditLogger {
  private readonly entries: AuditEntry[] = [];

  log(entry: AuditEntry): void {
    if (this.entries.some((e) => e.id === entry.id)) {
      throw new SecurityError(`Duplicate audit entry: ${entry.id}`, "DUPLICATE_AUDIT_ENTRY");
    }
    const checksum = simpleHash(JSON.stringify({ ...entry, checksum: undefined }));
    this.entries.push({ ...entry, checksum });
  }

  query(tenantId: string, eventType?: AuditEventType): AuditEntry[] {
    return this.entries.filter(
      (e) => e.tenantId === tenantId && (eventType === undefined || e.eventType === eventType),
    );
  }

  validateIntegrity(id: string): boolean {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw new SecurityError(`Audit entry not found: ${id}`, "AUDIT_NOT_FOUND");
    const { checksum, ...data } = entry;
    const recomputed = simpleHash(JSON.stringify(data));
    return recomputed === checksum;
  }

  exportAuditTrail(tenantId: string): AuditEntry[] {
    return this.entries
      .filter((e) => e.tenantId === tenantId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  detectAnomalies(tenantId: string, failureThreshold: number): AuditEntry[] {
    const failures = this.entries.filter((e) => e.tenantId === tenantId && e.outcome === "failure");
    if (failures.length >= failureThreshold) return failures;
    return [];
  }

  count(): number {
    return this.entries.length;
  }
}
