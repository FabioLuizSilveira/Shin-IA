import type { MobileContext } from "@/lib/mobile-context";

// Mobile screens phase (docs/architecture/INFRACTIONS_ENGINE.md) — same
// house pattern as mobile-inspections-scope.ts (P1.4): a pure,
// unit-testable predicate is how this codebase proves an isolation
// guarantee permanently, not just via a one-off live script.
// infraction_cases already carries operator_id AND customer_id directly
// (set by suggestResponsibility()/responsibility confirm, same columns
// inspections uses), so no extra query is needed to resolve visibility.
// "customer" kind added for the self-service closure round
// (INFRACTIONS_ENGINE.md) — additive to the union, not a rewrite, exactly
// as this comment originally planned.
// A customer identity is tenant-agnostic and can (rarely) have real
// organization links into more than one tenant (CustomerMobileContext.
// organizations[]) — unlike operator/tenant_user, which each have exactly
// one tenantId. "customer" carries the whole set of tenant ids the
// customer has a real link into, same source customerOrganizationIds()
// already uses for contracts (mobile-contracts-scope.ts), not a single
// tenantId.
export type InfractionVisibility =
  | { kind: "tenant"; tenantId: string }
  | { kind: "operator"; tenantId: string; operatorId: string }
  | { kind: "customer"; tenantIds: string[]; customerId: string }
  | null;

export function resolveInfractionVisibility(context: MobileContext): InfractionVisibility {
  if (context.userType === "tenant_user") {
    return { kind: "tenant", tenantId: context.tenantId };
  }
  if (context.userType === "operator") {
    return { kind: "operator", tenantId: context.tenantId, operatorId: context.operatorId };
  }
  if (context.userType === "customer") {
    return {
      kind: "customer",
      tenantIds: context.organizations.map((o) => o.tenantId),
      customerId: context.customerId,
    };
  }
  return null;
}

// Defense-in-depth predicate, same role as isInspectionVisible(): every
// route already enforces this via .eq() query filters, this makes the
// isolation guarantee itself directly testable.
export function isInfractionVisible(
  row: { tenant_id: string | null; operator_id: string | null; customer_id?: string | null },
  visibility: InfractionVisibility,
): boolean {
  if (!visibility) return false;
  if (visibility.kind === "tenant") return row.tenant_id === visibility.tenantId;
  if (visibility.kind === "operator") {
    return row.tenant_id === visibility.tenantId && row.operator_id === visibility.operatorId;
  }
  if (visibility.kind === "customer") {
    return (
      row.tenant_id !== null &&
      visibility.tenantIds.includes(row.tenant_id) &&
      row.customer_id === visibility.customerId
    );
  }
  return false;
}
