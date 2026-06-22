import type { RLSPolicy, IsolationResult, SecurityViolation } from "./types.js";

export interface QueryFilter {
  table: string;
  column: string;
  value: string;
}

export function validateRLSPolicy(policy: RLSPolicy): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  if (!policy.tenantId.trim())
    violations.push({
      rule: "RLS_TENANT_EMPTY",
      severity: "critical",
      detail: "TenantId cannot be empty",
    });
  if (!policy.table.trim())
    violations.push({
      rule: "RLS_TABLE_EMPTY",
      severity: "critical",
      detail: "Table cannot be empty",
    });
  if (!policy.column.trim())
    violations.push({
      rule: "RLS_COLUMN_EMPTY",
      severity: "high",
      detail: "Column cannot be empty",
    });
  if (!policy.value.trim())
    violations.push({ rule: "RLS_VALUE_EMPTY", severity: "high", detail: "Value cannot be empty" });
  return violations;
}

export function buildRLSFilter(tenantId: string, table: string): QueryFilter {
  return { table, column: "tenant_id", value: tenantId };
}

export function enforceRowSecurity(
  rows: Record<string, unknown>[],
  tenantId: string,
): Record<string, unknown>[] {
  return rows.filter((row) => row["tenant_id"] === tenantId);
}

export function computeTenantScope(tenantId: string, tables: string[]): RLSPolicy[] {
  return tables.map((table) => ({
    tenantId,
    table,
    column: "tenant_id",
    value: tenantId,
  }));
}

export function validateIsolation(
  rows: Record<string, unknown>[],
  expectedTenantId: string,
): IsolationResult {
  if (rows.length === 0) return "isolated";
  const allMatch = rows.every((r) => r["tenant_id"] === expectedTenantId);
  if (allMatch) return "isolated";
  const anyWrong = rows.some((r) => r["tenant_id"] !== expectedTenantId);
  return anyWrong ? "leaked" : "unknown";
}
