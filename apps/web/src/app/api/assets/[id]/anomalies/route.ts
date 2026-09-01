import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import {
  detectAssetAnomalies,
  type MaintenanceOrderType,
  type MaintenanceOrderStatus,
} from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

// Same select-string type-inference issue as the other maintenance
// routes -- explicit row shape + `as unknown as Row[]` cast.
interface MaintenanceOrderAnomalyRow {
  id: string;
  type: MaintenanceOrderType;
  status: MaintenanceOrderStatus;
  opened_at: string;
  total_cost_cents: number;
  downtime_start: string | null;
  downtime_end: string | null;
  odometer: number | null;
  maintenance_items: { component: string }[] | null;
}

// GET /api/assets/:id/anomalies (Etapa 6, P1) — rule/statistics-based
// anomaly detection over an asset's full maintenance history. No LLM, no
// persisted "detected anomalies" table: same on-demand-computation choice
// as the health-score route, for the same reason (cheap query, always
// fresh, no staleness to manage). Reuses tenant.maintenance.view.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assetId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: asset, error: assetError } = await scope.db
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (assetError) return internalError(assetError);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const { data: orders, error: ordersError } = await scope.db
    .from("maintenance_orders")
    .select(
      "id, type, status, opened_at, total_cost_cents, downtime_start, downtime_end, odometer, maintenance_items(component)",
    )
    .eq("tenant_id", scope.tenantId)
    .eq("asset_id", assetId)
    .is("deleted_at", null);
  if (ordersError) return internalError(ordersError);

  const rows = (orders ?? []) as unknown as MaintenanceOrderAnomalyRow[];
  const anomalies = detectAssetAnomalies(
    rows.map((r) => ({
      id: r.id,
      type: r.type,
      openedAt: r.opened_at,
      totalCostCents: r.total_cost_cents,
      downtimeStart: r.downtime_start,
      downtimeEnd: r.downtime_end,
      odometer: r.odometer,
      items: r.maintenance_items ?? [],
    })),
  );

  return NextResponse.json({ data: anomalies });
}
