import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import type { MaintenanceOrderType } from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

const SELECT =
  "id, asset_id, contract_id, customer_id, operator_id, supplier_id, branch_id, type, status, " +
  "opened_at, scheduled_at, started_at, completed_at, odometer, hour_meter, description, " +
  "labor_cost_cents, parts_cost_cents, other_cost_cents, total_cost_cents, downtime_start, downtime_end, " +
  "source_type, source_id, created_at, updated_at, " +
  "assets(id, name, category), organizations(id, name)";

// GET /api/maintenance — Etapa 3/17: lista com os filtros principais do
// spec (período, ativo, contrato, fornecedor, tipo, status). asset_type/
// branch/customer/operator/component/cost-center filters live at
// /api/assets/:id/maintenance and /api/maintenance/analytics instead of
// piling every possible filter onto this one list endpoint.
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  let query = scope.db
    .from("maintenance_orders")
    .select(SELECT)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null);

  const assetId = params.get("assetId");
  const status = params.get("status");
  const type = params.get("type");
  const contractId = params.get("contractId");
  const supplierId = params.get("supplierId");
  const periodStart = params.get("periodStart");
  const periodEnd = params.get("periodEnd");
  if (assetId) query = query.eq("asset_id", assetId);
  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  if (contractId) query = query.eq("contract_id", contractId);
  if (supplierId) query = query.eq("supplier_id", supplierId);
  if (periodStart) query = query.gte("opened_at", periodStart);
  if (periodEnd) query = query.lte("opened_at", periodEnd);

  const { data, error } = await query.order("opened_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface CreateOrderBody {
  assetId?: string;
  contractId?: string;
  customerId?: string;
  operatorId?: string;
  supplierId?: string;
  branchId?: string;
  type?: MaintenanceOrderType;
  description?: string;
  scheduledAt?: string;
  odometer?: number;
  hourMeter?: number;
  laborCostCents?: number;
  partsCostCents?: number;
  otherCostCents?: number;
  sourceType?: string;
  sourceId?: string;
  // "emergency"/"corrective" orders commonly start already underway --
  // the caller picks the initial status explicitly rather than this
  // route guessing from `type`; defaults to "scheduled".
  initialStatus?: "scheduled" | "in_progress";
}

// POST /api/maintenance — item central do spec (MaintenanceOrder). Every
// cost field defaults to 0; total_cost_cents is a DB generated column
// (labor+parts+other), never computed here, so there's exactly one place
// that can ever disagree with itself.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.maintenance.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateOrderBody | null;
  if (!body?.assetId || !body.type || !body.description?.trim()) {
    return NextResponse.json(
      { error: "assetId, type and description are required" },
      { status: 400 },
    );
  }

  const { data: asset, error: assetError } = await scope.db
    .from("assets")
    .select("id")
    .eq("id", body.assetId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (assetError) return internalError(assetError);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const orderId = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("maintenance_orders").insert({
    id: orderId,
    tenant_id: scope.tenantId,
    asset_id: body.assetId,
    contract_id: body.contractId ?? null,
    customer_id: body.customerId ?? null,
    operator_id: body.operatorId ?? null,
    supplier_id: body.supplierId ?? null,
    branch_id: body.branchId ?? null,
    type: body.type,
    status: body.initialStatus ?? "scheduled",
    scheduled_at: body.scheduledAt ?? null,
    started_at: body.initialStatus === "in_progress" ? new Date().toISOString() : null,
    odometer: body.odometer ?? null,
    hour_meter: body.hourMeter ?? null,
    description: body.description,
    labor_cost_cents: body.laborCostCents ?? 0,
    parts_cost_cents: body.partsCostCents ?? 0,
    other_cost_cents: body.otherCostCents ?? 0,
    source_type: body.sourceType ?? null,
    source_id: body.sourceId ?? null,
    created_by: scope.userId,
  });
  if (insertError) return internalError(insertError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "maintenance_order",
    entityId: orderId,
    action: "created",
    metadata: { assetId: body.assetId, type: body.type },
  });

  return NextResponse.json({ data: { id: orderId } }, { status: 201 });
}
