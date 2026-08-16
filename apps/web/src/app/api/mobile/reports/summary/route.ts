import { NextResponse, type NextRequest } from "next/server";
import { KpiEngine } from "@shina/reporting-engine";
import { requireMobileContext, type TenantUserMobileContext } from "@/lib/mobile-context";
import { hasTenantPermission } from "@/lib/tenant-context";
import { createKpiDataProvider } from "@/lib/kpi-data-provider";
import { resolveReportPeriod, isReportPeriodError } from "@/lib/mobile-report-period";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const FINANCIAL_KPI_TYPES = new Set(["revenue", "commissions"]);

// Wave 4 Phase B — tenant_user only (KPIs are whole-tenant, not something a
// customer/operator has a use case for in this spec). Composes the existing
// KpiEngine/createKpiDataProvider exactly as /api/tenant-reports already
// does — no Aggregation Engine reimplementation, no new KPI types beyond
// the 6 the Core engine actually supports (operations/assets/revenue/
// commissions/utilization/tracking). Financial KPIs (revenue, commissions)
// are OMITTED from the response entirely when the caller lacks
// tenant.dashboard.financial — never included-but-hidden, the permission
// check happens before the data ever leaves the server.
export async function GET(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "tenant_user") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = resolveReportPeriod(req.nextUrl.searchParams);
  if (isReportPeriodError(period)) {
    return NextResponse.json({ error: period.error }, { status: 422 });
  }

  try {
    const canSeeFinancial = await hasTenantPermission(
      context as TenantUserMobileContext,
      "tenant.dashboard.financial",
    );

    const engine = new KpiEngine(createKpiDataProvider(context.db));
    const kpis = await engine.computeAll(context.tenantId, period);
    const visibleKpis = kpis.filter((kpi) => canSeeFinancial || !FINANCIAL_KPI_TYPES.has(kpi.type));

    return NextResponse.json({ data: { period, kpis: visibleKpis } });
  } catch (error) {
    return internalError(error);
  }
}
