import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import {
  resolvePlanDue,
  type MaintenancePlan,
  type MaintenancePlanTriggerType,
} from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

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

// GET /api/maintenance/plans — item "próxima manutenção" do spec. Joins
// each plan against its asset's current odometer/hour_meter (when the
// plan is per-asset; a per-asset-type plan has no single current reading
// to compare against, so it's returned without a due estimate) and runs
// resolvePlanDue() so the list already tells the caller what's coming up
// instead of making the UI recompute it.
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assetId = req.nextUrl.searchParams.get("assetId");
  let query = scope.db
    .from("maintenance_plans")
    .select("*, assets(id, name, odometer, hour_meter)")
    .eq("tenant_id", scope.tenantId)
    .eq("active", true)
    .is("deleted_at", null);
  if (assetId) query = query.eq("asset_id", assetId);

  const { data, error } = await query.order("name", { ascending: true });
  if (error) return internalError(error);

  const now = new Date();
  const enriched = (data ?? []).map((row) => {
    const asset = row.assets as { odometer: number | null; hour_meter: number | null } | null;
    const due = resolvePlanDue(toEngineShape(row), {
      now,
      currentOdometer: asset?.odometer ?? null,
      currentHourMeter: asset?.hour_meter ?? null,
    });
    return { ...row, due };
  });

  return NextResponse.json({ data: enriched });
}

interface CreatePlanBody {
  assetId?: string;
  assetTypeId?: string;
  name?: string;
  triggerType?: MaintenancePlanTriggerType;
  intervalDays?: number;
  intervalOdometer?: number;
  intervalHourMeter?: number;
  conditionNotes?: string;
  lastTriggeredAt?: string;
  lastTriggeredOdometer?: number;
  lastTriggeredHourMeter?: number;
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.maintenance.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreatePlanBody | null;
  if (!body?.name?.trim() || !body.triggerType || (!body.assetId && !body.assetTypeId)) {
    return NextResponse.json(
      { error: "name, triggerType and (assetId or assetTypeId) are required" },
      { status: 400 },
    );
  }

  const planId = crypto.randomUUID();
  const { error } = await scope.db.from("maintenance_plans").insert({
    id: planId,
    tenant_id: scope.tenantId,
    asset_id: body.assetId ?? null,
    asset_type_id: body.assetId ? null : (body.assetTypeId ?? null),
    name: body.name,
    trigger_type: body.triggerType,
    interval_days: body.intervalDays ?? null,
    interval_odometer: body.intervalOdometer ?? null,
    interval_hour_meter: body.intervalHourMeter ?? null,
    condition_notes: body.conditionNotes ?? null,
    last_triggered_at: body.lastTriggeredAt ?? null,
    last_triggered_odometer: body.lastTriggeredOdometer ?? null,
    last_triggered_hour_meter: body.lastTriggeredHourMeter ?? null,
    created_by: scope.userId,
  });
  if (error) return internalError(error);

  return NextResponse.json({ data: { id: planId } }, { status: 201 });
}
