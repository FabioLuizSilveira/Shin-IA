import type { CustomerMobileContext } from "@/lib/mobile-context";

// Wave 4 Phase A — a rental_customer's real link to invoices is via
// billing_accounts.organization_id (billing_accounts already carries this
// column; invoices.billing_account_id points at it). This is broader and
// more correct than filtering by invoices.contract_id alone: a billing
// account can have recurring/non-contract invoices, and contract_id is
// nullable — chaining through organization membership (same
// rental_customer_organizations relationship every other customer-facing
// mobile route already uses) covers all of a customer's invoices, not just
// contract-generated ones.
export async function customerBillingAccountIds(
  context: CustomerMobileContext,
  organizationIds: string[],
): Promise<string[]> {
  if (organizationIds.length === 0) return [];
  const { data } = await context.db
    .from("billing_accounts")
    .select("id")
    .in("organization_id", organizationIds)
    .is("deleted_at", null);
  return (data ?? []).map((r) => r.id as string);
}
