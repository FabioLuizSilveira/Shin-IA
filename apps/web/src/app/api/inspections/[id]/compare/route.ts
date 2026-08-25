import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";
import { computeComparisons, type InspectionResponse } from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

function toDomainResponses(
  rows: {
    id: string;
    tenant_id: string;
    inspection_id: string;
    item_id: string;
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    value_json: unknown;
    notes: string | null;
  }[],
): InspectionResponse[] {
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    inspectionId: r.inspection_id,
    itemId: r.item_id,
    valueText: r.value_text,
    valueNumber: r.value_number,
    valueBoolean: r.value_boolean,
    valueJson: r.value_json as InspectionResponse["valueJson"],
    notes: r.notes,
  }));
}

// POST /api/inspections/:id/compare — :id is the "after" inspection
// (check_out/return); its linked_inspection_id is the "before"
// (check_in). Persists one inspection_comparisons row per template item
// (item 8 of the spec) so the UI reads a precomputed table instead of
// recomputing the diff on every page load. AI analysis is left null for
// every row — no InspectionMediaComparisonProvider is configured yet
// (see packages/inspection-engine's NullMediaComparisonProvider); this
// route already does the human-entered-data comparison in full, which
// works completely independently of whether AI is ever wired up.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.update"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: after, error: afterError } = await scope.db
    .from("inspections")
    .select("id, template_id, linked_inspection_id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (afterError) return internalError(afterError);
  if (!after) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (!after.linked_inspection_id) {
    return NextResponse.json(
      { error: "Inspection has no linked (before) inspection to compare against" },
      { status: 422 },
    );
  }

  const { data: before, error: beforeError } = await scope.db
    .from("inspections")
    .select("id, template_id")
    .eq("id", after.linked_inspection_id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (beforeError) return internalError(beforeError);
  if (!before) return NextResponse.json({ error: "Linked inspection not found" }, { status: 404 });

  const repo = createInspectionTemplateRepository(scope.db);
  // Compares against the AFTER inspection's template — check-in and
  // check-out are expected to resolve to the same template per
  // blueprint_inspection_mappings, but if a tenant reconfigured the
  // mapping between the two, comparing against the newer template is the
  // safer default (its items are the ones currently in use).
  const template = await repo.getHydratedTemplateById(after.template_id);
  if (!template) return internalError(new Error("template missing for inspection"));

  const [
    { data: beforeRows, error: beforeResponsesError },
    { data: afterRows, error: afterResponsesError },
  ] = await Promise.all([
    scope.db
      .from("inspection_responses")
      .select(
        "id, tenant_id, inspection_id, item_id, value_text, value_number, value_boolean, value_json, notes",
      )
      .eq("inspection_id", before.id),
    scope.db
      .from("inspection_responses")
      .select(
        "id, tenant_id, inspection_id, item_id, value_text, value_number, value_boolean, value_json, notes",
      )
      .eq("inspection_id", after.id),
  ]);
  if (beforeResponsesError) return internalError(beforeResponsesError);
  if (afterResponsesError) return internalError(afterResponsesError);

  const comparisons = computeComparisons({
    template,
    beforeResponses: toDomainResponses(beforeRows ?? []),
    afterResponses: toDomainResponses(afterRows ?? []),
  });

  const rows = comparisons.map((c) => ({
    tenant_id: scope.tenantId,
    before_inspection_id: before.id,
    after_inspection_id: after.id,
    item_id: c.itemId,
    before_value: c.beforeValue,
    after_value: c.afterValue,
    differs: c.differs,
    ai_analysis: null,
  }));

  // Idempotent — re-running compare after a late correction replaces the
  // previous comparison rows for this pair instead of accumulating stale
  // duplicates (same unique index already enforces one row per item/pair;
  // delete+insert is simpler than N individual upserts here).
  const { error: deleteError } = await scope.db
    .from("inspection_comparisons")
    .delete()
    .eq("before_inspection_id", before.id)
    .eq("after_inspection_id", after.id);
  if (deleteError) return internalError(deleteError);

  const { error: insertError } = await scope.db.from("inspection_comparisons").insert(rows);
  if (insertError) return internalError(insertError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection",
    entityId: after.id,
    action: "compared",
    metadata: {
      beforeInspectionId: before.id,
      differingItems: comparisons.filter((c) => c.differs).length,
    },
  });

  return NextResponse.json({ data: { comparisons } });
}
