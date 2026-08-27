import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { clientIp } from "@/lib/rate-limit";
import {
  canTransition,
  checkTemplateCompletion,
  hashContent,
  type InspectionStatus,
} from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

const SELECT =
  "id, tenant_id, asset_id, contract_id, type, status, linked_inspection_id, started_at, completed_at, created_at, template_id, metadata";

// Same allow-list as the operator route — a self-filling customer can
// drive their own draft/in_progress forward and submit or abandon it,
// but never jump straight to "completed"/"rejected", which stay a
// staff review action (tenant.inspections.approve).
const CUSTOMER_ALLOWED_TARGETS: InspectionStatus[] = ["in_progress", "pending_review", "abandoned"];

// GET /api/mobile/customer/inspections/:id — a customer only reaches
// "review this inspection" once the operator has actually submitted it
// (pending_review/completed); before that there's nothing coherent to
// show them yet. Cost/billing fields on findings are never exposed here
// — a customer sees what was found, not what the tenant is planning to
// charge for it (that's still a staff decision behind review_damage).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error } = await context.db
    .from("inspections")
    .select(SELECT)
    .eq("id", id)
    .eq("customer_id", context.customerId)
    .maybeSingle();
  if (error) return internalError(error);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const [
    { data: responses, error: responsesError },
    { data: media, error: mediaError },
    { data: findings, error: findingsError },
    { data: report },
    { data: disputes, error: disputesError },
  ] = await Promise.all([
    context.db
      .from("inspection_responses")
      .select("item_id, value_text, value_number, value_boolean, value_json, notes")
      .eq("inspection_id", id),
    context.db
      .from("inspection_media")
      .select("id, item_id, finding_id, media_type, storage_path, captured_at, sort_order")
      .eq("inspection_id", id)
      .order("sort_order", { ascending: true }),
    context.db
      .from("inspection_findings")
      .select("id, item_id, description, severity, status, preexisting_finding_id, overlay_region")
      .eq("inspection_id", id),
    context.db
      .from("inspection_reports")
      .select("id, version, content_hash, generated_at")
      .eq("inspection_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from("inspection_disputes")
      .select("id, item_id, description, status, created_at, resolution_notes")
      .eq("inspection_id", id)
      .eq("customer_id", context.customerId)
      .order("created_at", { ascending: false }),
  ]);
  if (responsesError) return internalError(responsesError);
  if (mediaError) return internalError(mediaError);
  if (findingsError) return internalError(findingsError);
  if (disputesError) return internalError(disputesError);

  const { data: acceptance } = await context.db
    .from("inspection_signatures")
    .select("id, signed_at")
    .eq("inspection_id", id)
    .eq("signer_type", "customer")
    .eq("customer_id", context.customerId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const repo = createInspectionTemplateRepository(context.db);
  const template = await repo.getHydratedTemplateById(inspection.template_id);

  return NextResponse.json({
    data: {
      inspection,
      template,
      responses: responses ?? [],
      media: media ?? [],
      findings: findings ?? [],
      report: report ?? null,
      disputes: disputes ?? [],
      acceptance: acceptance ?? null,
      canReview: inspection.status === "pending_review" || inspection.status === "completed",
      canFill:
        Boolean((inspection.metadata as { selfService?: boolean } | null)?.selfService) &&
        (inspection.status === "draft" || inspection.status === "in_progress"),
    },
  });
}

// PATCH /api/mobile/customer/inspections/:id — self-service status
// transition. Gated on metadata.selfService === true, same as the
// items/media routes. On the transition into "pending_review" — i.e.
// the customer finishing and submitting their own checklist — a
// customer signature is recorded automatically, server-side
// (signer_type=customer, document_hash/ip/user_agent/timestamp always
// backend-derived, never from the request body): per the explicit
// product decision, a customer filling out their own inspection and
// submitting it IS their acceptance of it, so there is no separate
// "Concordo" click for what they just wrote themselves. The accept/
// dispute routes still exist and still matter for the normal case
// (an operator or staff member filled it) — this only short-circuits
// the self-service case where requiring a second click to agree with
// yourself would be theater, not evidence.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await context.db
    .from("inspections")
    .select("id, tenant_id, status, template_id, metadata")
    .eq("id", id)
    .eq("customer_id", context.customerId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  const metadata = current.metadata as { selfService?: boolean } | null;
  if (!metadata?.selfService) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { status?: InspectionStatus };
  if (!body.status) return NextResponse.json({ error: "status is required" }, { status: 400 });
  if (!CUSTOMER_ALLOWED_TARGETS.includes(body.status)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canTransition(current.status as InspectionStatus, body.status)) {
    return NextResponse.json(
      { error: `cannot transition from ${current.status} to ${body.status}` },
      { status: 422 },
    );
  }

  let responsesForHash: unknown[] = [];
  let mediaForHash: unknown[] = [];
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
          .eq("inspection_id", id)
          .order("item_id", { ascending: true }),
        context.db
          .from("inspection_media")
          .select("id, item_id, checksum_sha256")
          .eq("inspection_id", id)
          .order("id", { ascending: true }),
      ]);
    if (responsesError) return internalError(responsesError);
    if (mediaError) return internalError(mediaError);
    responsesForHash = responses ?? [];
    mediaForHash = mediaRows ?? [];

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
    .eq("customer_id", context.customerId);
  if (updateError) return internalError(updateError);

  void logActivity(context.db, {
    tenantId: current.tenant_id,
    actorId: context.userId,
    entityType: "inspection",
    entityId: id,
    action: "status_changed",
    metadata: { from: current.status, to: body.status, actor: "customer" },
  });

  if (body.status === "pending_review") {
    const documentHash = await hashContent(
      JSON.stringify({ responses: responsesForHash, media: mediaForHash }),
    );
    const signatureId = crypto.randomUUID();
    const { error: signError } = await context.db.from("inspection_signatures").insert({
      id: signatureId,
      tenant_id: current.tenant_id,
      inspection_id: id,
      report_id: null,
      signer_type: "customer",
      customer_id: context.customerId,
      user_id: context.userId,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent") ?? null,
      document_hash: documentHash,
      acceptance_method: "clickwrap",
      metadata: { autoAcceptedOnSelfServiceSubmit: true },
    });
    if (signError) return internalError(signError);

    void logActivity(context.db, {
      tenantId: current.tenant_id,
      actorId: context.userId,
      entityType: "inspection",
      entityId: id,
      action: "accepted",
      metadata: { signerType: "customer", customerId: context.customerId, auto: true },
    });

    void createNotification({
      tenantId: current.tenant_id,
      subject: "Vistoria do cliente enviada",
      body: "O cliente preencheu e enviou a própria vistoria digital.",
      priority: "normal",
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
