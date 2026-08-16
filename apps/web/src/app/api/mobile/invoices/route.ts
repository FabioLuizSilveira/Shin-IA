import { NextResponse } from "next/server";
import {
  requireMobileContext,
  type TenantUserMobileContext,
  type CustomerMobileContext,
} from "@/lib/mobile-context";
import { hasTenantPermission } from "@/lib/tenant-context";
import { customerOrganizationIds } from "@/lib/mobile-contracts-scope";
import { customerBillingAccountIds } from "@/lib/mobile-billing-scope";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const SELECT =
  "id, billing_account_id, status, total_amount, total_currency, due_date, paid_at, created_at, " +
  "billing_accounts(id, cycle, organizations(id, name))";

// Wave 4 Phase A — read-only. Same financial-permission gate as
// /api/mobile/billing/summary for tenant_user; ownership-scoped (no
// permission needed) for customer. Mirrors the SELECT shape of the existing
// staff route (/api/invoices) rather than inventing a different DTO.
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  if (context.userType === "tenant_user") {
    const allowed = await hasTenantPermission(
      context as TenantUserMobileContext,
      "tenant.dashboard.financial",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await context.db
      .from("invoices")
      .select(SELECT)
      .eq("tenant_id", context.tenantId)
      .is("deleted_at", null)
      .order("due_date", { ascending: false });
    if (error) return internalError(error);
    return NextResponse.json({ data: data ?? [] });
  }

  if (context.userType === "customer") {
    const customerContext = context as CustomerMobileContext;
    const organizationIds = customerOrganizationIds(customerContext);
    const billingAccountIds = await customerBillingAccountIds(customerContext, organizationIds);
    if (billingAccountIds.length === 0) return NextResponse.json({ data: [] });

    const { data, error } = await context.db
      .from("invoices")
      .select(SELECT)
      .in("billing_account_id", billingAccountIds)
      .is("deleted_at", null)
      .order("due_date", { ascending: false });
    if (error) return internalError(error);
    return NextResponse.json({ data: data ?? [] });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
