import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

// See analytics/route.ts's comment on why this exists: a select() string
// built via concatenation can't be parsed by supabase-js's compile-time
// inference, so it falls back to an unusable type the moment specific
// fields are read off a row.
interface MaintenanceOrderHistoryRow {
  id: string;
  type: string;
  status: string;
  opened_at: string;
  completed_at: string | null;
  description: string;
  contract_id: string | null;
  supplier_id: string | null;
  labor_cost_cents: number;
  parts_cost_cents: number;
  other_cost_cents: number;
  total_cost_cents: number;
  downtime_start: string | null;
  downtime_end: string | null;
  source_type: string | null;
  source_id: string | null;
  organizations: { id: string; name: string } | null;
  maintenance_items: { id: string; component: string }[] | null;
}

// GET /assets/:id/maintenance (Etapa 3) — consolidated view for a single
// asset: history, cost breakdown, downtime, next preventive events. Two
// queries total (orders with a nested items select, plans), never N+1 --
// item costs are already denormalized onto the parent order via the DB's
// generated total_cost_cents column, so per-order cost never needs its
// own round trip either.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assetId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: asset, error: assetError } = await scope.db
    .from("assets")
    .select("id, name, category, odometer, hour_meter")
    .eq("id", assetId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (assetError) return internalError(assetError);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const [{ data: orders, error: ordersError }, { data: plans }] = await Promise.all([
    scope.db
      .from("maintenance_orders")
      .select(
        "id, type, status, opened_at, completed_at, description, contract_id, supplier_id, " +
          "labor_cost_cents, parts_cost_cents, other_cost_cents, total_cost_cents, " +
          "downtime_start, downtime_end, source_type, source_id, " +
          "organizations(id, name), maintenance_items(id, component)",
      )
      .eq("tenant_id", scope.tenantId)
      .eq("asset_id", assetId)
      .is("deleted_at", null)
      .order("opened_at", { ascending: false }),
    scope.db
      .from("maintenance_plans")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("asset_id", assetId)
      .eq("active", true)
      .is("deleted_at", null),
  ]);
  if (ordersError) return internalError(ordersError);

  const rows = (orders ?? []) as unknown as MaintenanceOrderHistoryRow[];
  const totalCostCents = rows.reduce((sum, r) => sum + (r.total_cost_cents ?? 0), 0);
  const preventiveCount = rows.filter((r) => r.type === "preventive").length;
  const correctiveCount = rows.filter(
    (r) => r.type === "corrective" || r.type === "emergency",
  ).length;

  // Reincidência (item 3: "se houve reincidência") -- same component
  // serviced more than once across different orders for this asset.
  const componentCounts = new Map<string, number>();
  for (const row of rows) {
    for (const item of row.maintenance_items ?? []) {
      componentCounts.set(item.component, (componentCounts.get(item.component) ?? 0) + 1);
    }
  }
  const recurringComponents = [...componentCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([component, count]) => ({ component, count }));

  const costPerOdometerUnit =
    asset.odometer && asset.odometer > 0 ? totalCostCents / asset.odometer : null;
  const costPerHourMeterUnit =
    asset.hour_meter && asset.hour_meter > 0 ? totalCostCents / asset.hour_meter : null;

  return NextResponse.json({
    data: {
      asset,
      summary: {
        totalCostCents,
        orderCount: rows.length,
        preventiveCount,
        correctiveCount,
        costPerOdometerUnit,
        costPerHourMeterUnit,
        recurringComponents,
      },
      orders: rows,
      plans: plans ?? [],
    },
  });
}
