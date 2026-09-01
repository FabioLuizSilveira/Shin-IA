import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import { computeAssetEconomics } from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

// GET /api/assets/:id/economics (Etapa 16, P2) — Asset Economics/TCO
// foundation. Reuses tenant.maintenance.analytics_view (seeded in the P0
// migration, not enforced by any route until now).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assetId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.analytics_view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: asset, error: assetError } = await scope.db
    .from("assets")
    .select("id, odometer, hour_meter, acquisition_cost_cents, created_at")
    .eq("id", assetId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (assetError) return internalError(assetError);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const { data: orders, error: ordersError } = await scope.db
    .from("maintenance_orders")
    .select("total_cost_cents")
    .eq("tenant_id", scope.tenantId)
    .eq("asset_id", assetId)
    .is("deleted_at", null);
  if (ordersError) return internalError(ordersError);

  const totalMaintenanceCostCents = (orders ?? []).reduce(
    (sum, o) => sum + ((o.total_cost_cents as number) ?? 0),
    0,
  );
  const ownershipDays = asset.created_at
    ? (Date.now() - new Date(asset.created_at).getTime()) / 86_400_000
    : null;

  const economics = computeAssetEconomics({
    totalMaintenanceCostCents,
    acquisitionCostCents: asset.acquisition_cost_cents,
    ownershipDays,
    odometer: asset.odometer,
    hourMeter: asset.hour_meter,
  });

  return NextResponse.json({ data: economics });
}
