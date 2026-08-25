import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const repo = createInspectionTemplateRepository(scope.db);
  const template = await repo.getHydratedTemplateById(id);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  // A tenant can read the global catalog and its own templates, never
  // another tenant's — matches the RLS policy exactly, checked again here
  // because getHydratedTemplateById() has no tenant filter of its own.
  if (template.tenantId !== null && template.tenantId !== scope.tenantId) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({ data: template });
}

interface PatchTemplateBody {
  name?: string;
  status?: "draft" | "published" | "archived";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Global templates (tenant_id null) are never editable through this
  // route — only a template the tenant itself owns.
  const { data: current, error: fetchError } = await scope.db
    .from("inspection_templates")
    .select("id, tenant_id, version")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const body = (await req.json()) as PatchTemplateBody;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name;
  if (body.status !== undefined) {
    update.status = body.status;
    if (body.status === "published") update.version = current.version + 1;
  }

  const { error: updateError } = await scope.db
    .from("inspection_templates")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection_template",
    entityId: id,
    action: "updated",
    metadata: { status: body.status },
  });

  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await scope.db
    .from("inspection_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (error) return internalError(error);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection_template",
    entityId: id,
    action: "deleted",
  });

  return NextResponse.json({ data: { ok: true } });
}
