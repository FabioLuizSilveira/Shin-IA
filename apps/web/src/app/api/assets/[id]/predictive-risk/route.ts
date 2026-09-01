import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import {
  resolvePlanDue,
  deriveHealthScoreInputs,
  computeAssetHealthScore,
  detectAssetAnomalies,
  computePredictiveRisk,
  type MaintenanceOrderType,
  type MaintenanceOrderStatus,
  type MaintenancePlan,
  type MaintenancePlanTriggerType,
} from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

interface MaintenanceOrderRow {
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

function toEngineShape(row: Record<string, unknown>): MaintenancePlan {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    assetId: (row.asset_id as string) ?? null,
    assetTypeId: (row.asset_type_id as string) ?? null,
    name: row.name as string,
    triggerType: row.trigger_type as MaintenancePlanTriggerType,
    intervalDays: (row.interval_days as number) ?? null,
    intervalOdometer: (row.interval_odometer as number) ?? null,
    intervalHourMeter: (row.interval_hour_meter as number) ?? null,
    conditionNotes: (row.condition_notes as string) ?? null,
    lastTriggeredAt: (row.last_triggered_at as string) ?? null,
    lastTriggeredOdometer: (row.last_triggered_odometer as number) ?? null,
    lastTriggeredHourMeter: (row.last_triggered_hour_meter as number) ?? null,
    active: row.active as boolean,
  };
}

// GET /api/assets/:id/predictive-risk (Etapa 8, P2) — deterministic risk
// estimate over signals this module already computes elsewhere (health
// score, anomalies, preventive-due proximity). Computed fresh on every
// read, same choice as health-score/anomalies -- no persisted table.
// Reuses tenant.maintenance.ai_use like recommendations: this is a
// derived, framed-as-AI-adjacent signal, not raw maintenance data.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assetId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.ai_use"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: asset, error: assetError } = await scope.db
    .from("assets")
    .select("id, odometer, hour_meter")
    .eq("id", assetId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (assetError) return internalError(assetError);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const [{ data: orders, error: ordersError }, { data: plans, error: plansError }] =
    await Promise.all([
      scope.db
        .from("maintenance_orders")
        .select(
          "id, type, status, opened_at, total_cost_cents, downtime_start, downtime_end, odometer, maintenance_items(component)",
        )
        .eq("tenant_id", scope.tenantId)
        .eq("asset_id", assetId)
        .is("deleted_at", null),
      scope.db
        .from("maintenance_plans")
        .select("*")
        .eq("tenant_id", scope.tenantId)
        .eq("asset_id", assetId)
        .eq("active", true)
        .is("deleted_at", null),
    ]);
  if (ordersError) return internalError(ordersError);
  if (plansError) return internalError(plansError);

  const now = new Date();
  const orderRows = (orders ?? []) as unknown as MaintenanceOrderRow[];
  const anomalyOrders = orderRows.map((r) => ({
    id: r.id,
    type: r.type,
    openedAt: r.opened_at,
    totalCostCents: r.total_cost_cents,
    downtimeStart: r.downtime_start,
    downtimeEnd: r.downtime_end,
    odometer: r.odometer,
    items: r.maintenance_items ?? [],
  }));
  const healthOrders = orderRows.map((r) => ({
    type: r.type,
    status: r.status,
    downtimeStart: r.downtime_start,
    downtimeEnd: r.downtime_end,
    openedAt: r.opened_at,
  }));

  const planContexts = (plans ?? []).map((row) => ({
    result: resolvePlanDue(toEngineShape(row), {
      now,
      currentOdometer: asset.odometer,
      currentHourMeter: asset.hour_meter,
    }),
    intervalOdometer: (row.interval_odometer as number) ?? null,
    intervalHourMeter: (row.interval_hour_meter as number) ?? null,
    intervalDays: (row.interval_days as number) ?? null,
  }));

  const healthScoreInput = deriveHealthScoreInputs({
    now,
    plansDue: planContexts.map((p) => ({ result: p.result })),
    orders: healthOrders,
  });
  const healthScore = computeAssetHealthScore(healthScoreInput);
  const anomalies = detectAssetAnomalies(anomalyOrders);

  const risk = computePredictiveRisk({ now, healthScore, anomalies, plans: planContexts });

  return NextResponse.json({ data: risk });
}
