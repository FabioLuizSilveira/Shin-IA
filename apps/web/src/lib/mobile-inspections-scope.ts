import type { MobileContext } from "@/lib/mobile-context";

// P1.4 — extracted for the same reason resolveOperationsVisibility exists
// (mobile-operations-scope.ts): a pure, directly-unit-testable function is
// how this codebase proves an isolation guarantee permanently, instead of
// only via a one-off script run against the hosted DB. Unlike operations
// (which needs a join through operator_assignments/
// tenant_contract_requirements), inspections carries operator_id/
// customer_id directly, so no DB query is needed to resolve visibility —
// it's a pure mapping from MobileContext to a filter descriptor.
export type InspectionVisibility =
  | { kind: "tenant"; tenantId: string }
  | { kind: "operator"; tenantId: string; operatorId: string }
  | { kind: "customer"; customerId: string }
  | null;

export function resolveInspectionVisibility(context: MobileContext): InspectionVisibility {
  if (context.userType === "tenant_user") {
    return { kind: "tenant", tenantId: context.tenantId };
  }
  if (context.userType === "operator") {
    return { kind: "operator", tenantId: context.tenantId, operatorId: context.operatorId };
  }
  if (context.userType === "customer") {
    return { kind: "customer", customerId: context.customerId };
  }
  return null;
}

// Defense-in-depth predicate — every route already enforces this via
// .eq() query filters (this function doesn't replace that), but having
// it as a pure predicate is what makes the isolation guarantee itself
// (not just the descriptor shape) directly testable: "operator A's
// visibility never matches operator B's row" becomes a real assertion,
// not just documentation.
export function isInspectionVisible(
  row: { tenant_id: string; operator_id: string | null; customer_id: string | null },
  visibility: InspectionVisibility,
): boolean {
  if (!visibility) return false;
  if (visibility.kind === "tenant") return row.tenant_id === visibility.tenantId;
  if (visibility.kind === "operator") {
    return row.tenant_id === visibility.tenantId && row.operator_id === visibility.operatorId;
  }
  if (visibility.kind === "customer") return row.customer_id === visibility.customerId;
  return false;
}
