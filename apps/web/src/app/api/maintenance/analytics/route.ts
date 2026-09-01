import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import { downtimeHours } from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

// A select() string built via concatenation (not a literal) can't be
// parsed by supabase-js's compile-time type inference -- it falls back
// to an unusable "GenericStringError" type the moment the code reads a
// specific field off a row. The query is still correct at runtime (the
// columns really exist); this interface just tells TS what comes back.
interface MaintenanceOrderAnalyticsRow {
  id: string;
  asset_id: string;
  contract_id: string | null;
  supplier_id: string | null;
  type: string;
  status: string;
  opened_at: string;
  downtime_start: string | null;
  downtime_end: string | null;
  labor_cost_cents: number;
  parts_cost_cents: number;
  other_cost_cents: number;
  total_cost_cents: number;
  assets: {
    id: string;
    name: string;
    asset_type_id: string | null;
    asset_types: { id: string; name: string } | null;
  } | null;
  organizations: { id: string; name: string } | null;
  contracts: { id: string } | null;
}

// GET /api/maintenance/analytics (Etapa 4). A dedicated aggregation
// route rather than forcing 12 new KPI types into
// packages/reporting-engine's KpiType union -- that union feeds the
// tenant dashboard's fixed 7-card grid (recently extended once already,
// for infractions); maintenance's own KPI set is wide enough (cost/km,
// cost/hour, MTTR, preventive-vs-corrective, cost-by-contract,
// cost-by-asset-type, cost trend...) that it reads better as its own
// endpoint the maintenance module's own analytics page calls directly,
// same as /api/tenant-reports already does for its own trend cards
// without going through KpiEngine either.
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.analytics_view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const periodStart = params.get("periodStart");
  const periodEnd = params.get("periodEnd");

  let query = scope.db
    .from("maintenance_orders")
    .select(
      "id, asset_id, contract_id, supplier_id, type, status, opened_at, downtime_start, downtime_end, " +
        "labor_cost_cents, parts_cost_cents, other_cost_cents, total_cost_cents, " +
        "assets(id, name, asset_type_id, asset_types(id, name)), organizations(id, name), contracts(id)",
    )
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null);
  if (periodStart) query = query.gte("opened_at", periodStart);
  if (periodEnd) query = query.lte("opened_at", periodEnd);

  const { data, error } = await query;
  if (error) return internalError(error);
  const rows = (data ?? []) as unknown as MaintenanceOrderAnalyticsRow[];

  const totalCostCents = rows.reduce((sum, r) => sum + (r.total_cost_cents ?? 0), 0);

  const preventiveCount = rows.filter((r) => r.type === "preventive").length;
  const unplannedCount = rows.filter(
    (r) => r.type === "corrective" || r.type === "emergency" || r.type === "predictive",
  ).length;

  const byType: Record<string, { count: number; costCents: number }> = {};
  for (const r of rows) {
    byType[r.type] ??= { count: 0, costCents: 0 };
    byType[r.type].count += 1;
    byType[r.type].costCents += r.total_cost_cents ?? 0;
  }

  const byAssetType = new Map<string, { name: string; count: number; costCents: number }>();
  for (const r of rows) {
    const assetType = r.assets?.asset_types;
    const key = assetType?.id ?? "unknown";
    const name = assetType?.name ?? "—";
    const entry = byAssetType.get(key) ?? { name, count: 0, costCents: 0 };
    entry.count += 1;
    entry.costCents += r.total_cost_cents ?? 0;
    byAssetType.set(key, entry);
  }

  const byContract = new Map<string, { count: number; costCents: number }>();
  for (const r of rows) {
    if (!r.contract_id) continue;
    const entry = byContract.get(r.contract_id) ?? { count: 0, costCents: 0 };
    entry.count += 1;
    entry.costCents += r.total_cost_cents ?? 0;
    byContract.set(r.contract_id, entry);
  }

  const bySupplier = new Map<string, { name: string; count: number; costCents: number }>();
  for (const r of rows) {
    if (!r.supplier_id) continue;
    const entry = bySupplier.get(r.supplier_id) ?? {
      name: r.organizations?.name ?? "—",
      count: 0,
      costCents: 0,
    };
    entry.count += 1;
    entry.costCents += r.total_cost_cents ?? 0;
    bySupplier.set(r.supplier_id, entry);
  }
  const supplierAvgCost = [...bySupplier.entries()].map(([id, v]) => ({
    supplierId: id,
    name: v.name,
    orderCount: v.count,
    avgCostCents: v.count > 0 ? Math.round(v.costCents / v.count) : 0,
  }));

  // Downtime / MTTR — only over orders that actually recorded both
  // bounds; never invents a downtime figure for an order that never
  // tracked one (item 5's "não apresentar falsa precisão" discipline).
  const downtimes = rows
    .map((r) => downtimeHours(r.downtime_start, r.downtime_end))
    .filter((h): h is number => h !== null);
  const totalDowntimeHours = downtimes.reduce((sum, h) => sum + h, 0);
  const mttrHours = downtimes.length > 0 ? totalDowntimeHours / downtimes.length : null;

  // MTBF proxy: for each asset, average time between consecutive
  // corrective/emergency orders. Needs at least 2 such events for a
  // given asset to mean anything -- assets with 0 or 1 never contribute
  // a number (again: no invented precision from a single data point).
  const correctiveByAsset = new Map<string, string[]>();
  for (const r of rows) {
    if (r.type !== "corrective" && r.type !== "emergency") continue;
    const list = correctiveByAsset.get(r.asset_id) ?? [];
    list.push(r.opened_at);
    correctiveByAsset.set(r.asset_id, list);
  }
  const mtbfGapsHours: number[] = [];
  for (const dates of correctiveByAsset.values()) {
    if (dates.length < 2) continue;
    const sorted = [...dates].sort();
    for (let i = 1; i < sorted.length; i++) {
      const gapMs = new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime();
      mtbfGapsHours.push(gapMs / (1000 * 60 * 60));
    }
  }
  const mtbfHours =
    mtbfGapsHours.length > 0
      ? mtbfGapsHours.reduce((sum, h) => sum + h, 0) / mtbfGapsHours.length
      : null;

  return NextResponse.json({
    data: {
      totalCostCents,
      orderCount: rows.length,
      preventiveVsCorrective: {
        preventiveCount,
        unplannedCount,
        ratio: unplannedCount > 0 ? preventiveCount / unplannedCount : null,
      },
      byType,
      byAssetType: [...byAssetType.entries()].map(([id, v]) => ({ assetTypeId: id, ...v })),
      byContract: [...byContract.entries()].map(([id, v]) => ({ contractId: id, ...v })),
      supplierAvgCost,
      downtime: {
        totalHours: totalDowntimeHours,
        mttrHours,
        sampledOrders: downtimes.length,
      },
      mtbfHours,
      mtbfSampleSize: mtbfGapsHours.length,
    },
  });
}
