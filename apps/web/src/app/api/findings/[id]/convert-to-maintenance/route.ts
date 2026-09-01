import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// Same select-string-concatenation type-inference issue as the
// maintenance module's own routes -- explicit row shape + `as unknown as
// Row` cast.
interface FindingWithInspectionRow {
  id: string;
  inspection_id: string;
  asset_id: string;
  description: string;
  location_on_asset: string | null;
  status: string;
  approved_cost_amount: number | null;
  maintenance_order_id: string | null;
  inspections: {
    branch_id: string | null;
    contract_id: string | null;
    customer_id: string | null;
    operator_id: string | null;
  } | null;
}

// A finding must already have gone through a human review decision
// before it can become a real maintenance order -- "detected"/
// "under_review" are still provisional (item 10 of the inspection spec:
// an AI suggestion never gets to skip human confirmation), "rejected"/
// "waived" mean a human already decided there's nothing to fix.
const CONVERTIBLE_STATUSES = new Set(["confirmed", "chargeable", "resolved"]);

// POST /api/findings/:id/convert-to-maintenance (Etapa 9) — creates a
// maintenance_orders row from a confirmed inspection finding, preserving
// the source reference both directions: the new order's
// source_type/source_id (P0) point at the finding, and the finding's own
// maintenance_order_id (this migration) points back. That back-reference
// also makes conversion naturally idempotent -- a finding converts to
// exactly one order, ever.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.maintenance.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: findingRow, error: fetchError } = await scope.db
    .from("inspection_findings")
    .select(
      "id, inspection_id, asset_id, description, location_on_asset, status, approved_cost_amount, maintenance_order_id, inspections(branch_id, contract_id, customer_id, operator_id)",
    )
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!findingRow) return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  const finding = findingRow as unknown as FindingWithInspectionRow;

  if (finding.maintenance_order_id) {
    return NextResponse.json(
      { error: "already converted", maintenanceOrderId: finding.maintenance_order_id },
      { status: 409 },
    );
  }
  if (!CONVERTIBLE_STATUSES.has(finding.status)) {
    return NextResponse.json(
      {
        error: `cannot convert a finding with status "${finding.status}" -- it must be confirmed, chargeable or resolved first`,
      },
      { status: 422 },
    );
  }

  const inspection = finding.inspections;

  const description = finding.location_on_asset
    ? `Vistoria: ${finding.description} (${finding.location_on_asset})`
    : `Vistoria: ${finding.description}`;

  // A human already approved this exact amount during the review step
  // (approved_cost_amount only ever gets set through PATCH
  // /api/findings/:id, never by an AI suggestion) -- reusing it as the
  // order's starting cost is carrying forward a real decision, not
  // inventing one. Staff can still edit it via the order's own PATCH.
  const otherCostCents = finding.approved_cost_amount
    ? Math.round(Number(finding.approved_cost_amount) * 100)
    : 0;

  const orderId = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("maintenance_orders").insert({
    id: orderId,
    tenant_id: scope.tenantId,
    asset_id: finding.asset_id,
    branch_id: inspection?.branch_id ?? null,
    contract_id: inspection?.contract_id ?? null,
    customer_id: inspection?.customer_id ?? null,
    operator_id: inspection?.operator_id ?? null,
    type: "inspection_generated",
    description,
    other_cost_cents: otherCostCents,
    source_type: "inspection_finding",
    source_id: finding.id,
    created_by: scope.userId,
  });
  if (insertError) return internalError(insertError);

  const { error: updateError } = await scope.db
    .from("inspection_findings")
    .update({ maintenance_order_id: orderId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) {
    // The order already exists and is a valid, independently-correct
    // record even if this back-reference write fails -- don't roll it
    // back over a linkage-metadata error, just surface it.
    return internalError(updateError);
  }

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection_finding",
    entityId: id,
    action: "converted_to_maintenance",
    metadata: { maintenanceOrderId: orderId },
  });

  return NextResponse.json({ data: { id: orderId } }, { status: 201 });
}
