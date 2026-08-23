import { NextResponse } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/mobile/customer/invoices — web customer portal's RLS→API
// migration (rentals-portal.ts's fetchMyInvoices). Scoped via
// billing_accounts.organization_id in the caller's own linked
// organizations, same join the old RLS policy (invoices_select_rental_customer,
// 20260090000000) used.
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgIds = context.organizations.map((o) => o.organizationId);
  if (orgIds.length === 0) return NextResponse.json({ data: [] });

  const { data: billingAccounts } = await context.db
    .from("billing_accounts")
    .select("id")
    .in("organization_id", orgIds);
  const billingAccountIds = (billingAccounts ?? []).map((b) => b.id);
  if (billingAccountIds.length === 0) return NextResponse.json({ data: [] });

  const { data, error } = await context.db
    .from("invoices")
    .select("id, status, total_amount, total_currency, due_date, paid_at")
    .in("billing_account_id", billingAccountIds)
    .order("due_date", { ascending: false })
    .limit(10);
  if (error) return internalError(error);

  return NextResponse.json({ data: data ?? [] });
}
