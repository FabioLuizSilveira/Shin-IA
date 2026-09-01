import type { TenantScope } from "@/lib/tenant-context";
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

// Pre-approved query functions for the AI Copilot (Etapa 13). Every
// function here is tenant-scoped (via TenantScope, never a client-
// supplied tenantId), read-only, and returns plain structured data --
// never a query string, never anything the LLM could turn into SQL. This
// is a deliberate small amount of duplication against the individual
// health-score/anomalies/etc. API routes rather than a refactor of
// already-shipped, already-verified routes to share this code -- lower
// risk, matches this module's own "no unrelated refactors" rule.

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

async function loadAssetSignals(scope: TenantScope, assetId: string) {
  const { data: asset } = await scope.db
    .from("assets")
    .select("id, name, odometer, hour_meter")
    .eq("id", assetId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (!asset) return null;

  const [{ data: orders }, { data: plans }] = await Promise.all([
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

  const now = new Date();
  const orderRows = (orders ?? []) as unknown as MaintenanceOrderRow[];
  const plansDue = (plans ?? []).map((row) => ({
    planId: row.id as string,
    planName: row.name as string,
    intervalOdometer: (row.interval_odometer as number) ?? null,
    intervalHourMeter: (row.interval_hour_meter as number) ?? null,
    intervalDays: (row.interval_days as number) ?? null,
    result: resolvePlanDue(toEngineShape(row), {
      now,
      currentOdometer: asset.odometer,
      currentHourMeter: asset.hour_meter,
    }),
  }));

  return { asset, orderRows, plansDue, now };
}

export async function toolGetAssetHealthScore(scope: TenantScope, assetId: string) {
  const signals = await loadAssetSignals(scope, assetId);
  if (!signals) return { error: "asset not found" };
  const healthOrders = signals.orderRows.map((r) => ({
    type: r.type,
    status: r.status,
    downtimeStart: r.downtime_start,
    downtimeEnd: r.downtime_end,
    openedAt: r.opened_at,
  }));
  const input = deriveHealthScoreInputs({
    now: signals.now,
    plansDue: signals.plansDue.map((p) => ({ result: p.result })),
    orders: healthOrders,
  });
  return { assetName: signals.asset.name, ...computeAssetHealthScore(input) };
}

export async function toolGetAssetAnomalies(scope: TenantScope, assetId: string) {
  const signals = await loadAssetSignals(scope, assetId);
  if (!signals) return { error: "asset not found" };
  const anomalyOrders = signals.orderRows.map((r) => ({
    id: r.id,
    type: r.type,
    openedAt: r.opened_at,
    totalCostCents: r.total_cost_cents,
    downtimeStart: r.downtime_start,
    downtimeEnd: r.downtime_end,
    odometer: r.odometer,
    items: r.maintenance_items ?? [],
  }));
  return { assetName: signals.asset.name, anomalies: detectAssetAnomalies(anomalyOrders) };
}

export async function toolGetAssetPredictiveRisk(scope: TenantScope, assetId: string) {
  const signals = await loadAssetSignals(scope, assetId);
  if (!signals) return { error: "asset not found" };
  const healthOrders = signals.orderRows.map((r) => ({
    type: r.type,
    status: r.status,
    downtimeStart: r.downtime_start,
    downtimeEnd: r.downtime_end,
    openedAt: r.opened_at,
  }));
  const anomalyOrders = signals.orderRows.map((r) => ({
    id: r.id,
    type: r.type,
    openedAt: r.opened_at,
    totalCostCents: r.total_cost_cents,
    downtimeStart: r.downtime_start,
    downtimeEnd: r.downtime_end,
    odometer: r.odometer,
    items: r.maintenance_items ?? [],
  }));
  const healthScoreInput = deriveHealthScoreInputs({
    now: signals.now,
    plansDue: signals.plansDue.map((p) => ({ result: p.result })),
    orders: healthOrders,
  });
  const healthScore = computeAssetHealthScore(healthScoreInput);
  const anomalies = detectAssetAnomalies(anomalyOrders);
  const risk = computePredictiveRisk({
    now: signals.now,
    healthScore,
    anomalies,
    plans: signals.plansDue.map((p) => ({
      result: p.result,
      intervalOdometer: p.intervalOdometer,
      intervalHourMeter: p.intervalHourMeter,
      intervalDays: p.intervalDays,
    })),
  });
  return { assetName: signals.asset.name, ...risk };
}

export async function toolGetAssetMaintenanceHistory(scope: TenantScope, assetId: string) {
  const signals = await loadAssetSignals(scope, assetId);
  if (!signals) return { error: "asset not found" };
  const totalCostCents = signals.orderRows.reduce((sum, r) => sum + (r.total_cost_cents ?? 0), 0);
  const componentCounts = new Map<string, number>();
  for (const row of signals.orderRows) {
    for (const item of row.maintenance_items ?? []) {
      componentCounts.set(item.component, (componentCounts.get(item.component) ?? 0) + 1);
    }
  }
  const recurringComponents = [...componentCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([component, count]) => ({ component, count }));

  return {
    assetName: signals.asset.name,
    orderCount: signals.orderRows.length,
    totalCostCents,
    recurringComponents,
    upcomingPreventive: signals.plansDue.map((p) => ({
      name: p.planName,
      isDue: p.result.isDue,
      nearest: p.result.nearest,
    })),
    recentOrders: signals.orderRows
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
      .slice(0, 5)
      .map((r) => ({
        type: r.type,
        status: r.status,
        openedAt: r.opened_at,
        totalCostCents: r.total_cost_cents,
      })),
  };
}

export async function toolGetOpenRecommendations(scope: TenantScope, assetId?: string) {
  let query = scope.db
    .from("maintenance_recommendations")
    .select("asset_id, type, priority, message")
    .eq("tenant_id", scope.tenantId)
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .limit(20);
  if (assetId) query = query.eq("asset_id", assetId);
  const { data } = await query;
  return { recommendations: data ?? [] };
}

export async function toolGetFleetOverview(scope: TenantScope) {
  const [{ data: orders }, { data: assetsCount }] = await Promise.all([
    scope.db
      .from("maintenance_orders")
      .select("status, type, total_cost_cents, opened_at")
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null),
    scope.db
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", scope.tenantId)
      .is("deleted_at", null),
  ]);

  const rows = orders ?? [];
  const openStatuses = new Set(["scheduled", "awaiting_approval", "approved", "in_progress"]);
  const openOrderCount = rows.filter((o) => openStatuses.has(o.status)).length;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const recentCostCents = rows
    .filter((o) => o.opened_at >= thirtyDaysAgo)
    .reduce((sum, o) => sum + ((o.total_cost_cents as number) ?? 0), 0);

  return {
    totalAssets: assetsCount ?? 0,
    totalOrders: rows.length,
    openOrderCount,
    maintenanceCostLast30DaysCents: recentCostCents,
  };
}
