import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";
import {
  resolvePlanDue,
  deriveHealthScoreInputs,
  computeAssetHealthScore,
  type MaintenanceOrderStatus,
  type MaintenanceOrderType,
  type MaintenancePlan,
  type MaintenancePlanTriggerType,
} from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

// Same select-string-concatenation type-inference issue as
// assets/[id]/maintenance/route.ts and maintenance/analytics/route.ts --
// explicit row shape + `as unknown as Row[]` cast.
interface MaintenanceOrderScoreRow {
  type: MaintenanceOrderType;
  status: MaintenanceOrderStatus;
  opened_at: string;
  downtime_start: string | null;
  downtime_end: string | null;
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

// GET /api/assets/:id/health-score (Etapa 5, P1) — deterministic, versioned
// 0-100 score, computed fresh from live data on every read. No LLM, no ML,
// no persisted "latest score" table: the aggregation query is cheap and
// re-running it avoids ever serving a stale cached number. Reuses
// tenant.maintenance.view -- this is deterministic arithmetic over
// maintenance data the same permission already gates, not a distinct
// capability that needs its own IAM key.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assetId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.view"))) {
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
        .select("type, status, opened_at, downtime_start, downtime_end")
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
  const orderRows = (orders ?? []) as unknown as MaintenanceOrderScoreRow[];
  const engineOrders = orderRows.map((r) => ({
    type: r.type,
    status: r.status,
    downtimeStart: r.downtime_start,
    downtimeEnd: r.downtime_end,
    openedAt: r.opened_at,
  }));

  const plansDue = (plans ?? []).map((row) => ({
    result: resolvePlanDue(toEngineShape(row), {
      now,
      currentOdometer: asset.odometer,
      currentHourMeter: asset.hour_meter,
    }),
  }));

  const input = deriveHealthScoreInputs({ now, plansDue, orders: engineOrders });
  const result = computeAssetHealthScore(input);

  return NextResponse.json({ data: { ...result, inputs: input, computedAt: now.toISOString() } });
}
