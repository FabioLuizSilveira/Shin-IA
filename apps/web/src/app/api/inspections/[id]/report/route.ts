import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";
import { hashContent } from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

// GET returns the latest report (if any) — the drawer uses this to decide
// whether to show "Gerar Laudo" or the report itself.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("inspection_reports")
    .select("id, version, rendered_content, content_hash, generated_by, generated_at")
    .eq("inspection_id", id)
    .eq("tenant_id", scope.tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

// POST /api/inspections/:id/report — generates the digital laudo (item 13
// of the spec). Immutable snapshot, same pattern as
// tenant_contract_snapshots: a new version is a new row, an existing
// report is never edited. Only from a "completed" inspection — the laudo
// documents what the reviewer actually approved, not a work-in-progress
// checklist.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.approve"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await scope.db
    .from("inspections")
    .select(
      "id, tenant_id, asset_id, contract_id, customer_id, operator_id, responsible_user_id, template_id, type, status, linked_inspection_id, started_at, completed_at",
    )
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (inspection.status !== "completed") {
    return NextResponse.json(
      { error: "Só é possível gerar laudo de uma vistoria concluída." },
      { status: 422 },
    );
  }

  const repo = createInspectionTemplateRepository(scope.db);
  const template = await repo.getHydratedTemplateById(inspection.template_id);

  const [{ data: responses }, { data: media }, { data: findings }, { data: previousVersion }] =
    await Promise.all([
      scope.db
        .from("inspection_responses")
        .select("item_id, value_text, value_number, value_boolean, value_json, notes")
        .eq("inspection_id", id),
      scope.db
        .from("inspection_media")
        .select("id, item_id, finding_id, media_type, storage_path, captured_at")
        .eq("inspection_id", id),
      scope.db
        .from("inspection_findings")
        .select(
          "id, item_id, description, severity, status, estimated_cost_amount, approved_cost_amount",
        )
        .eq("inspection_id", id),
      scope.db
        .from("inspection_reports")
        .select("version")
        .eq("inspection_id", id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const renderedContent = {
    inspection,
    template,
    responses: responses ?? [],
    media: media ?? [],
    findings: findings ?? [],
    generatedAt: new Date().toISOString(),
  };
  const contentHash = await hashContent(JSON.stringify(renderedContent));
  const version = (previousVersion?.version ?? 0) + 1;

  const reportId = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("inspection_reports").insert({
    id: reportId,
    tenant_id: scope.tenantId,
    inspection_id: id,
    version,
    rendered_content: renderedContent,
    content_hash: contentHash,
    generated_by: scope.userId,
  });
  if (insertError) return internalError(insertError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection",
    entityId: id,
    action: "report_generated",
    metadata: { reportId, version },
  });

  void createNotification({
    tenantId: scope.tenantId,
    subject: "Laudo de vistoria disponível",
    body: "O laudo digital da vistoria foi gerado e está disponível para consulta.",
    priority: "normal",
  });

  return NextResponse.json({ data: { id: reportId, version, contentHash } }, { status: 201 });
}
