import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

interface CreateFindingBody {
  inspectionId?: string;
  itemId?: string;
  locationOnAsset?: string;
  description?: string;
  category?: string;
  severity?: "low" | "medium" | "high" | "critical";
  overlayRegion?: unknown;
}

// POST /api/findings — a human recording a constatação/avaria (item 9 of
// the spec). status always starts at "detected" regardless of who raised
// it — there's no "confirmed" shortcut on create, matching aiSuggested
// defaulting to false here (this route is for humans; an AI-raised
// finding would set ai_suggested/ai_confidence, which nothing writes yet
// since no InspectionMediaComparisonProvider is configured).
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.review_damage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as CreateFindingBody;
  if (!body.inspectionId || !body.description) {
    return NextResponse.json(
      { error: "inspectionId and description are required" },
      { status: 400 },
    );
  }

  const { data: inspection, error: inspectionError } = await scope.db
    .from("inspections")
    .select("id, asset_id")
    .eq("id", body.inspectionId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const id = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("inspection_findings").insert({
    id,
    tenant_id: scope.tenantId,
    inspection_id: body.inspectionId,
    asset_id: inspection.asset_id,
    item_id: body.itemId ?? null,
    location_on_asset: body.locationOnAsset ?? null,
    description: body.description,
    category: body.category ?? null,
    severity: body.severity ?? "medium",
    status: "detected",
    overlay_region: body.overlayRegion ?? null,
  });
  if (insertError) return internalError(insertError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection_finding",
    entityId: id,
    action: "created",
    metadata: { inspectionId: body.inspectionId },
  });

  return NextResponse.json({ data: { id, status: "detected" } }, { status: 201 });
}
