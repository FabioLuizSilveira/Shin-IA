import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

interface CreateSectionBody {
  key?: string;
  title?: string;
  instructions?: string;
  sortOrder?: number;
}

// POST /api/inspection-templates/:id/sections — only on a template the
// tenant owns (same ownership check as the template PATCH route); a
// tenant can read the global catalog but never adds sections to it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: template, error: templateError } = await scope.db
    .from("inspection_templates")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (templateError) return internalError(templateError);
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const body = (await req.json()) as CreateSectionBody;
  if (!body.key || !body.title) {
    return NextResponse.json({ error: "key and title are required" }, { status: 400 });
  }

  const sectionId = crypto.randomUUID();
  const { error } = await scope.db.from("inspection_template_sections").insert({
    id: sectionId,
    template_id: id,
    tenant_id: scope.tenantId,
    key: body.key,
    title: body.title,
    instructions: body.instructions ?? null,
    sort_order: body.sortOrder ?? 0,
  });
  if (error) return internalError(error);

  return NextResponse.json({ data: { id: sectionId } }, { status: 201 });
}
