import type { CustomerMobileContext } from "@/lib/mobile-context";

// Wave 3 Phase A — contracts are organization-scoped (contracts.organization_id),
// and a rental_customer only ever reaches an organization through the same
// real relationship every other mobile-facing customer route already uses:
// rental_customer_organizations. No new relationship invented. tenant_user
// staff already have full contract visibility via the existing /api/contracts
// route (requireTenantScope) — reused, not duplicated here.
export function customerOrganizationIds(context: CustomerMobileContext): string[] {
  return context.organizations.map((o) => o.organizationId);
}
