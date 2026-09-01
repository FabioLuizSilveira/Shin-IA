import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

interface CreateItemBody {
  component?: string;
  serviceType?: string;
  description?: string;
  partNumber?: string;
  quantity?: number;
  unitCostCents?: number;
  laborCostCents?: number;
  warrantyUntil?: string;
  warrantyKm?: number;
  warrantyHours?: number;
}

// POST /api/maintenance/:id/items — MaintenanceItem (item 2 do spec).
// component/service_type stay free text (same reasoning as
// inspection_findings.location_on_asset -- the vocabulary varies too
// much across asset categories for a closed enum).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.maintenance.update"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: order, error: orderError } = await scope.db
    .from("maintenance_orders")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (orderError) return internalError(orderError);
  if (!order) return NextResponse.json({ error: "Maintenance order not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as CreateItemBody | null;
  if (!body?.component?.trim() || !body.serviceType?.trim() || !body.description?.trim()) {
    return NextResponse.json(
      { error: "component, serviceType and description are required" },
      { status: 400 },
    );
  }

  const itemId = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("maintenance_items").insert({
    id: itemId,
    tenant_id: scope.tenantId,
    maintenance_order_id: id,
    component: body.component,
    service_type: body.serviceType,
    description: body.description,
    part_number: body.partNumber ?? null,
    quantity: body.quantity ?? null,
    unit_cost_cents: body.unitCostCents ?? null,
    labor_cost_cents: body.laborCostCents ?? null,
    warranty_until: body.warrantyUntil ?? null,
    warranty_km: body.warrantyKm ?? null,
    warranty_hours: body.warrantyHours ?? null,
  });
  if (insertError) return internalError(insertError);

  return NextResponse.json({ data: { id: itemId } }, { status: 201 });
}
