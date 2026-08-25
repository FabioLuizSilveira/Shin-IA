import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import type { InspectionFieldType, SelectOption, FieldCondition } from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

interface PatchItemBody {
  label?: string;
  fieldType?: InspectionFieldType;
  required?: boolean;
  instructions?: string | null;
  referenceImageUrl?: string | null;
  minPhotos?: number | null;
  maxPhotos?: number | null;
  selectOptions?: SelectOption[] | null;
  condition?: FieldCondition | null;
  approvalGate?: boolean;
  sortOrder?: number;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string; itemId: string }> },
) {
  const { id, sectionId, itemId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: item, error: itemError } = await scope.db
    .from("inspection_template_items")
    .select("id")
    .eq("id", itemId)
    .eq("section_id", sectionId)
    .eq("template_id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (itemError) return internalError(itemError);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const body = (await req.json()) as PatchItemBody;
  const update: Record<string, unknown> = {};
  if (body.label !== undefined) update.label = body.label;
  if (body.fieldType !== undefined) update.field_type = body.fieldType;
  if (body.required !== undefined) update.required = body.required;
  if (body.instructions !== undefined) update.instructions = body.instructions;
  if (body.referenceImageUrl !== undefined) update.reference_image_url = body.referenceImageUrl;
  if (body.minPhotos !== undefined) update.min_photos = body.minPhotos;
  if (body.maxPhotos !== undefined) update.max_photos = body.maxPhotos;
  if (body.selectOptions !== undefined) update.select_options = body.selectOptions;
  if (body.condition !== undefined) update.condition = body.condition;
  if (body.approvalGate !== undefined) update.approval_gate = body.approvalGate;
  if (body.sortOrder !== undefined) update.sort_order = body.sortOrder;

  const { error } = await scope.db
    .from("inspection_template_items")
    .update(update)
    .eq("id", itemId);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string; itemId: string }> },
) {
  const { id, sectionId, itemId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await scope.db
    .from("inspection_template_items")
    .delete()
    .eq("id", itemId)
    .eq("section_id", sectionId)
    .eq("template_id", id)
    .eq("tenant_id", scope.tenantId);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
