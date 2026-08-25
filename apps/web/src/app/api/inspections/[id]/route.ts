import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";
import {
  canTransition,
  checkTemplateCompletion,
  type InspectionStatus,
} from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

const SELECT =
  "id, asset_id, contract_id, operation_id, customer_id, operator_id, responsible_user_id, template_id, type, status, linked_inspection_id, started_at, completed_at, created_at, updated_at";

// Which permission a given transition requires — completing/rejecting is
// a review action, everything else is normal fill-in-the-checklist work.
// Mirrors the shape of api/operations/[id]/route.ts's single
// "operations:write" check, split per-transition here because inspection
// review is a materially different capability from just filling it out.
function permissionForTransition(to: InspectionStatus): string {
  if (to === "completed" || to === "rejected") return "tenant.inspections.approve";
  return "tenant.inspections.update";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: inspection, error } = await scope.db
    .from("inspections")
    .select(SELECT)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (error) return internalError(error);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const [
    { data: responses, error: responsesError },
    { data: media, error: mediaError },
    { data: findings, error: findingsError },
    { data: disputes, error: disputesError },
  ] = await Promise.all([
    scope.db
      .from("inspection_responses")
      .select("id, item_id, value_text, value_number, value_boolean, value_json, notes")
      .eq("inspection_id", id),
    scope.db
      .from("inspection_media")
      .select(
        "id, item_id, finding_id, media_type, storage_path, original_filename, captured_at, sort_order",
      )
      .eq("inspection_id", id)
      .order("sort_order", { ascending: true }),
    scope.db
      .from("inspection_findings")
      .select(
        "id, item_id, description, severity, status, ai_suggested, preexisting_finding_id, overlay_region",
      )
      .eq("inspection_id", id),
    scope.db
      .from("inspection_disputes")
      .select("id, item_id, customer_id, description, status, resolution_notes, created_at")
      .eq("inspection_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (responsesError) return internalError(responsesError);
  if (mediaError) return internalError(mediaError);
  if (findingsError) return internalError(findingsError);
  if (disputesError) return internalError(disputesError);

  const repo = createInspectionTemplateRepository(scope.db);
  const template = await repo.getHydratedTemplateById(inspection.template_id);

  return NextResponse.json({
    data: {
      inspection,
      template,
      responses: responses ?? [],
      media: media ?? [],
      findings: findings ?? [],
      disputes: disputes ?? [],
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { status?: InspectionStatus };
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  if (!(await hasTenantPermission(scope, permissionForTransition(body.status)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await scope.db
    .from("inspections")
    .select("status, template_id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  if (!canTransition(current.status as InspectionStatus, body.status)) {
    return NextResponse.json(
      { error: `cannot transition from ${current.status} to ${body.status}` },
      { status: 422 },
    );
  }

  // Moving into pending_review is "I'm done filling this out" — verify
  // the checklist is actually complete first, same principle as
  // OperationContractGate blocking pending->in_progress: never write the
  // new status until the precondition is proven, not just assumed.
  if (body.status === "pending_review") {
    const repo = createInspectionTemplateRepository(scope.db);
    const template = await repo.getHydratedTemplateById(current.template_id);
    if (!template) return internalError(new Error("template missing for inspection"));

    const [{ data: responses, error: responsesError }, { data: mediaRows, error: mediaError }] =
      await Promise.all([
        scope.db
          .from("inspection_responses")
          .select(
            "id, tenant_id, inspection_id, item_id, value_text, value_number, value_boolean, value_json, notes",
          )
          .eq("inspection_id", id),
        scope.db.from("inspection_media").select("item_id").eq("inspection_id", id),
      ]);
    if (responsesError) return internalError(responsesError);
    if (mediaError) return internalError(mediaError);

    const mediaCountByItemId = new Map<string, number>();
    for (const row of mediaRows ?? []) {
      if (!row.item_id) continue;
      mediaCountByItemId.set(row.item_id, (mediaCountByItemId.get(row.item_id) ?? 0) + 1);
    }

    const completion = checkTemplateCompletion({
      template,
      responses: (responses ?? []).map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        inspectionId: r.inspection_id,
        itemId: r.item_id,
        valueText: r.value_text,
        valueNumber: r.value_number,
        valueBoolean: r.value_boolean,
        valueJson: r.value_json,
        notes: r.notes,
      })),
      mediaCountByItemId,
    });

    if (!completion.canComplete) {
      return NextResponse.json(
        {
          error: "inspection_incomplete",
          missingRequiredItems: completion.missingRequiredItems,
          photoCountViolations: completion.photoCountViolations,
        },
        { status: 422 },
      );
    }

    // Gate failures don't block submission for review — they're exactly
    // what review is for — but they're surfaced so the UI can prompt
    // "record a Finding for this before submitting" without hard-blocking.
    if (completion.gateFailures.length > 0) {
      void logActivity(scope.db, {
        tenantId: scope.tenantId,
        actorId: scope.userId,
        entityType: "inspection",
        entityId: id,
        action: "gate_failures_present",
        metadata: { gateFailures: completion.gateFailures },
      });
    }
  }

  const update: Record<string, unknown> = {
    status: body.status,
    updated_at: new Date().toISOString(),
  };
  if (body.status === "in_progress") update.started_at = new Date().toISOString();
  if (body.status === "completed") update.completed_at = new Date().toISOString();

  const { error: updateError } = await scope.db
    .from("inspections")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection",
    entityId: id,
    action: "status_changed",
    metadata: { from: current.status, to: body.status },
  });

  if (body.status === "rejected") {
    void createNotification({
      tenantId: scope.tenantId,
      subject: "Vistoria reprovada",
      body: "Uma vistoria foi reprovada na revisão e precisa de atenção.",
      priority: "high",
    });
  }
  if (body.status === "pending_review") {
    void createNotification({
      tenantId: scope.tenantId,
      subject: "Vistoria aguardando revisão",
      body: "Uma vistoria foi enviada e está aguardando revisão.",
      priority: "normal",
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
