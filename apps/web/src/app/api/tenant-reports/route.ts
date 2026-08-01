import { NextResponse, type NextRequest } from "next/server";
import { KpiEngine } from "@shina/reporting-engine";
import { requireTenantScope } from "@/lib/tenant-context";
import { createKpiDataProvider } from "@/lib/kpi-data-provider";

export const dynamic = "force-dynamic";

// Defaults to the current calendar month — ?period=starts_at,ends_at (ISO)
// overrides it. computeAll compares this window against the equal-length
// window immediately before it (see kpi-data-provider.ts).
function resolvePeriod(req: NextRequest): { start: string; end: string } {
  const raw = req.nextUrl.searchParams.get("period");
  if (raw) {
    const [start, end] = raw.split(",");
    if (start && end) return { start, end };
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const supabase = scope.db;
  const tenantId = scope.tenantId;

  const [opsRes, assetsRes, contractsRes, invoicesRes] = await Promise.all([
    supabase.from("operations").select("status").eq("tenant_id", tenantId).is("deleted_at", null),
    supabase.from("assets").select("category").eq("tenant_id", tenantId).is("deleted_at", null),
    supabase
      .from("contracts")
      .select("status, value_amount")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("status, total_amount")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
  ]);

  const errors = [opsRes, assetsRes, contractsRes, invoicesRes].map((r) => r.error).filter(Boolean);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0]?.message }, { status: 500 });
  }

  const ops = opsRes.data ?? [];
  const assets = assetsRes.data ?? [];
  const contracts = contractsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];

  const countBy = <T extends string>(
    rows: { status?: T; category?: T }[],
    key: "status" | "category",
  ) => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const value = (row[key] as string | undefined) ?? "unknown";
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  };

  const contractsValueByStatus: Record<string, number> = {};
  for (const c of contracts) {
    contractsValueByStatus[c.status] =
      (contractsValueByStatus[c.status] ?? 0) + Number(c.value_amount);
  }

  const invoicesAmountByStatus: Record<string, number> = {};
  for (const i of invoices) {
    invoicesAmountByStatus[i.status] =
      (invoicesAmountByStatus[i.status] ?? 0) + Number(i.total_amount);
  }

  const period = resolvePeriod(req);
  const kpiEngine = new KpiEngine(createKpiDataProvider(supabase));
  const kpis = await kpiEngine.computeAll(tenantId, period);

  return NextResponse.json({
    data: {
      operationsByStatus: countBy(ops, "status"),
      assetsByCategory: countBy(assets, "category"),
      contractsValueByStatus,
      invoicesAmountByStatus,
      kpis,
      period,
    },
  });
}
