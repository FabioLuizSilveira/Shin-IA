import { NextResponse, type NextRequest } from "next/server";
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
  "id, billing_account_id, status, previous_status, total_amount, total_currency, due_date, paid_at, " +
  "created_at, billing_accounts(id, cycle, organizations(id, name))";

interface InvoiceDetailRow {
  id: string;
  billing_account_id: string;
}

// Wave 4 Phase A — read-only detail with line items. No document/PDF field:
// the only existing "printable invoice" is a staff-only web page
// (financial/invoices/[id]/print) that itself just calls the staff invoice
// route — there is no real signed document/PDF artifact to link to, so
// none is invented here (documented gap, not silently omitted).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType === "unprovisioned" || context.userType === "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = context.db.from("invoices").select(SELECT).eq("id", id).is("deleted_at", null);

  if (context.userType === "tenant_user") {
    const allowed = await hasTenantPermission(
      context as TenantUserMobileContext,
      "tenant.dashboard.financial",
    );
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    query = query.eq("tenant_id", context.tenantId);
  } else if (context.userType === "customer") {
    const customerContext = context as CustomerMobileContext;
    const organizationIds = customerOrganizationIds(customerContext);
    const billingAccountIds = await customerBillingAccountIds(customerContext, organizationIds);
    if (billingAccountIds.length === 0) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    query = query.in("billing_account_id", billingAccountIds);
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rawInvoice, error } = await query.maybeSingle();
  if (error) return internalError(error);
  if (!rawInvoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const invoice = rawInvoice as unknown as InvoiceDetailRow;

  const { data: lineItems, error: lineItemsError } = await context.db
    .from("invoice_line_items")
    .select("id, description, quantity, unit_price_amount, unit_price_currency, sort_order")
    .eq("invoice_id", invoice.id)
    .order("sort_order", { ascending: true });
  if (lineItemsError) return internalError(lineItemsError);

  return NextResponse.json({ data: { ...invoice, lineItems: lineItems ?? [] } });
}
