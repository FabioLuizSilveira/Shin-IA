import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import {
  canTransition,
  checkTemplateCompletion,
  type InspectionStatus,
} from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

const SELECT =
  "id, asset_id, contract_id, operation_id, customer_id, operator_id, template_id, type, status, linked_inspection_id, started_at, completed_at, created_at, updated_at";

// Only transitions an operator is allowed to drive themselves — never
// "completed"/"rejected", which stay a staff review action
// (tenant.inspections.approve). An operator finishing their work submits
// for review; a human on the tenant side decides the final outcome. This
// mirrors permissionForTransition() in api/inspections/[id]/route.ts but
// is deliberately a smaller allow-list, not a permission lookup — an
// operator has no tenant_role/permission rows to check against at all.
const OPERATOR_ALLOWED_TARGETS: InspectionStatus[] = ["in_progress", "pending_review", "abandoned"];

async function loadOwnedInspection(
  db: SupabaseClient,
  tenantId: string,
  operatorId: string,
  id: string,
) {
  return db
    .from("inspections")
    .select(SELECT)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("operator_id", operatorId)
    .maybeSingle();
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error } = await loadOwnedInspection(
    context.db,
    context.tenantId,
    context.operatorId,
    id,
  );
  if (error) return internalError(error);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const [
    { data: responses, error: responsesError },
    { data: media, error: mediaError },
    { data: findings, error: findingsError },
  ] = await Promise.all([
    context.db
      .from("inspection_responses")
      .select("id, item_id, value_text, value_number, value_boolean, value_json, notes")
      .eq("inspection_id", id),
    context.db
      .from("inspection_media")
      .select(
        "id, item_id, finding_id, media_type, storage_path, original_filename, captured_at, sort_order",
      )
      .eq("inspection_id", id)
      .order("sort_order", { ascending: true }),
    // Operator sees findings on their own inspection (needed to review
    // preexisting damage before signing) but never findings' cost/billing
    // fields — those stay staff-only, filtered out of the select below.
    context.db
      .from("inspection_findings")
      .select("id, item_id, description, severity, status, preexisting_finding_id, overlay_region")
      .eq("inspection_id", id),
  ]);
  if (responsesError) return internalError(responsesError);
  if (mediaError) return internalError(mediaError);
  if (findingsError) return internalError(findingsError);

  const repo = createInspectionTemplateRepository(context.db);
  const template = await repo.getHydratedTemplateById(inspection.template_id);

  return NextResponse.json({
    data: {
      inspection,
      template,
      responses: responses ?? [],
      media: media ?? [],
      findings: findings ?? [],
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { status?: InspectionStatus };
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });
  if (!OPERATOR_ALLOWED_TARGETS.includes(body.status)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await loadOwnedInspection(
    context.db,
    context.tenantId,
    context.operatorId,
    id,
  );
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  if (!canTransition(current.status as InspectionStatus, body.status)) {
    return NextResponse.json(
      { error: `cannot transition from ${current.status} to ${body.status}` },
      { status: 422 },
    );
  }

  if (body.status === "pending_review") {
    const repo = createInspectionTemplateRepository(context.db);
    const template = await repo.getHydratedTemplateById(current.template_id);
    if (!template) return internalError(new Error("template missing for inspection"));

    const [{ data: responses, error: responsesError }, { data: mediaRows, error: mediaError }] =
      await Promise.all([
        context.db
          .from("inspection_responses")
          .select(
            "id, tenant_id, inspection_id, item_id, value_text, value_number, value_boolean, value_json, notes",
          )
          .eq("inspection_id", id),
        context.db.from("inspection_media").select("item_id").eq("inspection_id", id),
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
  }

  const update: Record<string, unknown> = {
    status: body.status,
    updated_at: new Date().toISOString(),
  };
  if (body.status === "in_progress") update.started_at = new Date().toISOString();

  const { error: updateError } = await context.db
    .from("inspections")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", context.tenantId)
    .eq("operator_id", context.operatorId);
  if (updateError) return internalError(updateError);

  void logActivity(context.db, {
    tenantId: context.tenantId,
    actorId: context.userId,
    entityType: "inspection",
    entityId: id,
    action: "status_changed",
    metadata: { from: current.status, to: body.status, actor: "operator" },
  });

  if (body.status === "pending_review") {
    void createNotification({
      tenantId: context.tenantId,
      subject: "Vistoria aguardando revisão",
      body: "Uma vistoria foi enviada pelo operador e está aguardando revisão.",
      priority: "normal",
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
