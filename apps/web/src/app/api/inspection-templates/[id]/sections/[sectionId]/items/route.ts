import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import type { InspectionFieldType, SelectOption, FieldCondition } from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

interface CreateItemBody {
  key?: string;
  label?: string;
  fieldType?: InspectionFieldType;
  required?: boolean;
  instructions?: string;
  referenceImageUrl?: string;
  minPhotos?: number;
  maxPhotos?: number;
  selectOptions?: SelectOption[];
  condition?: FieldCondition;
  approvalGate?: boolean;
  sortOrder?: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> },
) {
  const { id, sectionId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The section must belong to a template this tenant owns — verified via
  // the join, not assumed from the URL (same IDOR discipline as every
  // other new route this module added).
  const { data: section, error: sectionError } = await scope.db
    .from("inspection_template_sections")
    .select("id, template_id, tenant_id")
    .eq("id", sectionId)
    .eq("template_id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (sectionError) return internalError(sectionError);
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  const body = (await req.json()) as CreateItemBody;
  if (!body.key || !body.label || !body.fieldType) {
    return NextResponse.json({ error: "key, label and fieldType are required" }, { status: 400 });
  }

  const itemId = crypto.randomUUID();
  const { error } = await scope.db.from("inspection_template_items").insert({
    id: itemId,
    section_id: sectionId,
    template_id: id,
    tenant_id: scope.tenantId,
    key: body.key,
    label: body.label,
    field_type: body.fieldType,
    required: body.required ?? false,
    instructions: body.instructions ?? null,
    reference_image_url: body.referenceImageUrl ?? null,
    min_photos: body.minPhotos ?? null,
    max_photos: body.maxPhotos ?? null,
    select_options: body.selectOptions ?? null,
    condition: body.condition ?? null,
    approval_gate: body.approvalGate ?? false,
    sort_order: body.sortOrder ?? 0,
  });
  if (error) return internalError(error);

  return NextResponse.json({ data: { id: itemId } }, { status: 201 });
}
