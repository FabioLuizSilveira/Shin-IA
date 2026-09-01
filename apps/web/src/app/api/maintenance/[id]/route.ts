import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { canTransitionOrder, type MaintenanceOrderStatus } from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

// GET /api/maintenance/:id — detail + items + documents, in parallel.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: order, error } = await scope.db
    .from("maintenance_orders")
    .select("*, assets(id, name, category), organizations(id, name)")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return internalError(error);
  if (!order) return NextResponse.json({ error: "Maintenance order not found" }, { status: 404 });

  const [{ data: items }, { data: documents }] = await Promise.all([
    scope.db
      .from("maintenance_items")
      .select("*")
      .eq("maintenance_order_id", id)
      .order("created_at", { ascending: true }),
    scope.db
      .from("maintenance_documents")
      .select("*")
      .eq("maintenance_order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    data: { order, items: items ?? [], documents: documents ?? [] },
  });
}

interface PatchOrderBody {
  status?: MaintenanceOrderStatus;
  description?: string;
  diagnosis?: string;
  cause?: string;
  resolution?: string;
  laborCostCents?: number;
  partsCostCents?: number;
  otherCostCents?: number;
  scheduledAt?: string;
  odometer?: number;
  hourMeter?: number;
  downtimeStart?: string;
  downtimeEnd?: string;
  supplierId?: string;
}

// PATCH /api/maintenance/:id — field edits and/or a status transition.
// An invalid transition is a real 422, never a silent no-op -- the exact
// class of bug the Infractions Engine round found and fixed live.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await scope.db
    .from("maintenance_orders")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Maintenance order not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchOrderBody;

  // Status transitions to "approved"/"completed" require their own
  // permission (item 18: approve/complete are distinct from update),
  // every other field edit only requires the general update permission.
  const requiredPermission =
    body.status === "approved"
      ? "tenant.maintenance.approve"
      : body.status === "completed"
        ? "tenant.maintenance.complete"
        : "tenant.maintenance.update";
  if (!(await hasTenantPermission(scope, requiredPermission))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.description !== undefined) patch.description = body.description;
  if (body.diagnosis !== undefined) patch.diagnosis = body.diagnosis;
  if (body.cause !== undefined) patch.cause = body.cause;
  if (body.resolution !== undefined) patch.resolution = body.resolution;
  if (body.laborCostCents !== undefined) patch.labor_cost_cents = body.laborCostCents;
  if (body.partsCostCents !== undefined) patch.parts_cost_cents = body.partsCostCents;
  if (body.otherCostCents !== undefined) patch.other_cost_cents = body.otherCostCents;
  if (body.scheduledAt !== undefined) patch.scheduled_at = body.scheduledAt;
  if (body.odometer !== undefined) patch.odometer = body.odometer;
  if (body.hourMeter !== undefined) patch.hour_meter = body.hourMeter;
  if (body.downtimeStart !== undefined) patch.downtime_start = body.downtimeStart;
  if (body.downtimeEnd !== undefined) patch.downtime_end = body.downtimeEnd;
  if (body.supplierId !== undefined) patch.supplier_id = body.supplierId;

  if (body.status && body.status !== current.status) {
    if (!canTransitionOrder(current.status as MaintenanceOrderStatus, body.status)) {
      return NextResponse.json(
        { error: `cannot transition from ${current.status} to ${body.status}` },
        { status: 422 },
      );
    }
    patch.status = body.status;
    if (body.status === "in_progress") patch.started_at = new Date().toISOString();
    if (body.status === "completed") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = scope.userId;
    }
    if (body.status === "approved") patch.approved_by = scope.userId;
  }

  const { error: updateError } = await scope.db
    .from("maintenance_orders")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  if (body.status && body.status !== current.status) {
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "maintenance_order",
      entityId: id,
      action: "status_changed",
      metadata: { from: current.status, to: body.status },
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
