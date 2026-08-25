import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

interface UpsertResponseBody {
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueJson?: unknown;
  notes?: string | null;
}

// PATCH /api/inspections/:id/items/:itemId — upserts one checklist
// answer. One row per (inspection, item) — unique index in the schema
// enforces this, so re-submitting the same item corrects it instead of
// accumulating duplicate rows (offline/resiliency requirement, item 19
// of the spec: retrying an upload must be idempotent).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.update"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await scope.db
    .from("inspections")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (inspection.status !== "draft" && inspection.status !== "in_progress") {
    return NextResponse.json(
      { error: `cannot edit responses while inspection is ${inspection.status}` },
      { status: 422 },
    );
  }

  // The item must actually belong to this inspection's template — never
  // trust itemId at face value (same IDOR discipline as customer-contracts
  // routes: ownership verified in the query, not assumed from the URL).
  const { data: item, error: itemError } = await scope.db
    .from("inspection_template_items")
    .select("id, template_id")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError) return internalError(itemError);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const { data: insp, error: inspTemplateError } = await scope.db
    .from("inspections")
    .select("template_id")
    .eq("id", id)
    .maybeSingle();
  if (inspTemplateError) return internalError(inspTemplateError);
  if (insp?.template_id !== item.template_id) {
    return NextResponse.json(
      { error: "Item does not belong to this inspection's template" },
      { status: 422 },
    );
  }

  const body = (await req.json()) as UpsertResponseBody;

  // id is left out on purpose — the column defaults to gen_random_uuid()
  // on insert, and on conflict (update) it must stay untouched, not be
  // reassigned to a fresh value every re-save.
  const { error: upsertError } = await scope.db.from("inspection_responses").upsert(
    {
      tenant_id: scope.tenantId,
      inspection_id: id,
      item_id: itemId,
      value_text: body.valueText ?? null,
      value_number: body.valueNumber ?? null,
      value_boolean: body.valueBoolean ?? null,
      value_json: body.valueJson ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "inspection_id,item_id" },
  );
  if (upsertError) return internalError(upsertError);

  return NextResponse.json({ data: { ok: true } });
}
