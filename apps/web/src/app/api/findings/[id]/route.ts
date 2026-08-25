import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { canTransitionFinding, type InspectionFindingStatus } from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

interface PatchFindingBody {
  status?: InspectionFindingStatus;
  decisionNotes?: string;
  estimatedCostAmount?: number;
  estimatedCostCurrency?: string;
  approvedCostAmount?: number;
  approvedCostCurrency?: string;
}

// PATCH /api/findings/:id — the review step for a constatação (item 9 of
// the spec: DETECTED -> UNDER_REVIEW -> CONFIRMED/REJECTED ->
// CHARGEABLE/WAIVED -> RESOLVED). Confirming or rejecting is always a
// human decision through this route — an AI suggestion (when a real
// InspectionMediaComparisonProvider is eventually configured) only ever
// creates a finding at "detected", never writes past it (item 10 of the
// spec: "IA não deve decidir automaticamente que o cliente causou uma
// avaria").
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.review_damage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await scope.db
    .from("inspection_findings")
    .select("id, status, inspection_id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  const body = (await req.json()) as PatchFindingBody;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.decisionNotes !== undefined) update.decision_notes = body.decisionNotes;
  if (body.estimatedCostAmount !== undefined) {
    update.estimated_cost_amount = body.estimatedCostAmount;
    update.estimated_cost_currency = body.estimatedCostCurrency ?? "BRL";
  }
  if (body.approvedCostAmount !== undefined) {
    update.approved_cost_amount = body.approvedCostAmount;
    update.approved_cost_currency = body.approvedCostCurrency ?? "BRL";
  }

  if (body.status) {
    if (!canTransitionFinding(current.status as InspectionFindingStatus, body.status)) {
      return NextResponse.json(
        { error: `cannot transition from ${current.status} to ${body.status}` },
        { status: 422 },
      );
    }
    update.status = body.status;
    update.responsible_user_id = scope.userId;
  }

  const { error: updateError } = await scope.db
    .from("inspection_findings")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  if (body.status) {
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "inspection_finding",
      entityId: id,
      action: "status_changed",
      metadata: { from: current.status, to: body.status },
    });

    if (body.status === "confirmed") {
      void createNotification({
        tenantId: scope.tenantId,
        subject: "Avaria confirmada",
        body: "Uma constatação de vistoria foi confirmada e pode gerar cobrança.",
        priority: "high",
      });
    }
  }

  return NextResponse.json({ data: { ok: true } });
}
