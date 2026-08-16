import { NextResponse } from "next/server";
import { requireMobileContext, type TenantUserMobileContext } from "@/lib/mobile-context";
import { hasTenantPermission } from "@/lib/tenant-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

interface TransactionRow {
  status: string;
  total_amount: number;
  currency: string;
}

// Wave 4 Phase A — tenant_user only, same tenant.dashboard.financial gate
// (no dedicated commission permission key exists in the catalog — commission
// is financial data, reuses the established key rather than inventing a new
// one). Sums amounts already computed and stored by the real
// CommissionCalculator at transaction-creation time (packages/commission-engine,
// used by POST /api/commissions/transactions) — this endpoint only
// aggregates existing rows, it never recomputes a commission_amount/
// bonus_amount/total_amount itself.
export async function GET() {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "tenant_user") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allowed = await hasTenantPermission(
    context as TenantUserMobileContext,
    "tenant.dashboard.financial",
  );
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: transactions, error } = await context.db
    .from("commission_transactions")
    .select("status, total_amount, currency")
    .eq("tenant_id", context.tenantId);
  if (error) return internalError(error);

  const rows = (transactions ?? []) as TransactionRow[];
  const currency = rows[0]?.currency ?? "BRL";
  const byStatus: Record<string, { amount: number; count: number }> = {};
  for (const row of rows) {
    const bucket = byStatus[row.status] ?? { amount: 0, count: 0 };
    bucket.amount += Number(row.total_amount);
    bucket.count += 1;
    byStatus[row.status] = bucket;
  }

  return NextResponse.json({ data: { currency, byStatus } });
}
