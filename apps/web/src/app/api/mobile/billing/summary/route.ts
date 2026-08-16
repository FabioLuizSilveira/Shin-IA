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
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

interface InvoiceRow {
  id: string;
  status: string;
  total_amount: number;
  total_currency: string;
  due_date: string;
  paid_at: string | null;
}

interface Summary {
  receivables: { amount: number; currency: string; count: number };
  overdue: { amount: number; currency: string; count: number };
  paid: { amount: number; currency: string; count: number };
  nextDue: { invoiceId: string; amount: number; currency: string; dueDate: string } | null;
}

function buildSummary(invoices: InvoiceRow[]): Summary {
  const currency = invoices[0]?.total_currency ?? "BRL";
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const receivable = invoices.filter((i) => i.status === "issued" || i.status === "overdue");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const paidThisMonth = invoices.filter(
    (i) => i.status === "paid" && i.paid_at && new Date(i.paid_at) >= monthStart,
  );

  const nextDue = receivable.slice().sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  return {
    receivables: {
      amount: receivable.reduce((sum, i) => sum + Number(i.total_amount), 0),
      currency,
      count: receivable.length,
    },
    overdue: {
      amount: overdue.reduce((sum, i) => sum + Number(i.total_amount), 0),
      currency,
      count: overdue.length,
    },
    paid: {
      amount: paidThisMonth.reduce((sum, i) => sum + Number(i.total_amount), 0),
      currency,
      count: paidThisMonth.length,
    },
    nextDue: nextDue
      ? {
          invoiceId: nextDue.id,
          amount: Number(nextDue.total_amount),
          currency,
          dueDate: nextDue.due_date,
        }
      : null,
  };
}

async function fetchInvoices(db: SupabaseClient, filter: { column: string; values: string[] }) {
  if (filter.values.length === 0) return [] as InvoiceRow[];
  const { data, error } = await db
    .from("invoices")
    .select("id, status, total_amount, total_currency, due_date, paid_at")
    .in(filter.column, filter.values)
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as InvoiceRow[];
}

// Wave 4 Phase A — financial data requires the SAME permission key already
// established for the dashboard's financial slice (tenant.dashboard.financial,
// Wave 2 Phase A) — reused, not a new key invented for this one endpoint.
// Entitlement/subscription status alone is never sufficient by itself; this
// is a tenant_permissions catalog check, independent of what the tenant's
// own Shinã plan includes. Customer identities have no permission catalog
// concept for their own data — ownership (billing_accounts.organization_id
// via rental_customer_organizations) IS the security boundary, same pattern
// as contracts/documents/tracking.
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  try {
    if (context.userType === "tenant_user") {
      const allowed = await hasTenantPermission(
        context as TenantUserMobileContext,
        "tenant.dashboard.financial",
      );
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const invoices = await fetchInvoices(context.db, {
        column: "tenant_id",
        values: [context.tenantId],
      });
      return NextResponse.json({ data: buildSummary(invoices) });
    }

    if (context.userType === "customer") {
      const customerContext = context as CustomerMobileContext;
      const organizationIds = customerOrganizationIds(customerContext);
      const billingAccountIds = await customerBillingAccountIds(customerContext, organizationIds);
      const invoices = await fetchInvoices(context.db, {
        column: "billing_account_id",
        values: billingAccountIds,
      });
      return NextResponse.json({ data: buildSummary(invoices) });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (error) {
    return internalError(error);
  }
}
