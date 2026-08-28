import type { MobileContext } from "@/lib/mobile-context";

// Mobile screens phase (docs/architecture/INFRACTIONS_ENGINE.md) — same
// house pattern as mobile-inspections-scope.ts (P1.4): a pure,
// unit-testable predicate is how this codebase proves an isolation
// guarantee permanently, not just via a one-off live script.
// infraction_cases already carries operator_id directly (set by
// suggestResponsibility()/responsibility confirm, same column
// inspections uses), so no extra query is needed to resolve visibility.
// No "customer" kind yet — no customer-facing infraction route exists
// (documented gap, INFRACTIONS_ENGINE.md's pendencies), so this only
// ever resolves "tenant" or "operator" today; the shape stays a
// discriminated union so adding customer later is additive, not a
// rewrite.
export type InfractionVisibility =
  | { kind: "tenant"; tenantId: string }
  | { kind: "operator"; tenantId: string; operatorId: string }
  | null;

export function resolveInfractionVisibility(context: MobileContext): InfractionVisibility {
  if (context.userType === "tenant_user") {
    return { kind: "tenant", tenantId: context.tenantId };
  }
  if (context.userType === "operator") {
    return { kind: "operator", tenantId: context.tenantId, operatorId: context.operatorId };
  }
  return null;
}

// Defense-in-depth predicate, same role as isInspectionVisible(): every
// route already enforces this via .eq() query filters, this makes the
// isolation guarantee itself directly testable.
export function isInfractionVisible(
  row: { tenant_id: string | null; operator_id: string | null },
  visibility: InfractionVisibility,
): boolean {
  if (!visibility) return false;
  if (visibility.kind === "tenant") return row.tenant_id === visibility.tenantId;
  if (visibility.kind === "operator") {
    return row.tenant_id === visibility.tenantId && row.operator_id === visibility.operatorId;
  }
  return false;
}
