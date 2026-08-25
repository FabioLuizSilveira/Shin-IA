import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

interface CreateFindingBody {
  itemId?: string;
  description?: string;
  severity?: "low" | "medium" | "high" | "critical";
  overlayRegion?: unknown;
}

// POST /api/mobile/operator-inspections/:id/findings — operator's
// equivalent of api/findings (staff), scoped to inspections assigned to
// this operator. Item 12 of the spec: the operator marks damage
// themselves on the spot, during capture — this is what lets that
// happen without a tenant_role/permission row, which an operator
// structurally has none of. status always starts at "detected"
// regardless of who raised it, same as the staff route — an operator
// recording damage is not the same authority as staff confirming it
// (tenant.inspections.review_damage), which stays exclusively a
// requireTenantScope() action.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await context.db
    .from("inspections")
    .select("id, asset_id, status")
    .eq("id", id)
    .eq("tenant_id", context.tenantId)
    .eq("operator_id", context.operatorId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (inspection.status !== "draft" && inspection.status !== "in_progress") {
    return NextResponse.json(
      { error: `cannot add findings while inspection is ${inspection.status}` },
      { status: 422 },
    );
  }

  const body = (await req.json()) as CreateFindingBody;
  if (!body.description || !body.description.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  if (body.itemId) {
    const { data: insp } = await context.db
      .from("inspections")
      .select("template_id")
      .eq("id", id)
      .maybeSingle();
    const { data: item } = await context.db
      .from("inspection_template_items")
      .select("id, template_id")
      .eq("id", body.itemId)
      .maybeSingle();
    if (!item || item.template_id !== insp?.template_id) {
      return NextResponse.json(
        { error: "Item does not belong to this inspection's template" },
        { status: 422 },
      );
    }
  }

  const findingId = crypto.randomUUID();
  const { error: insertError } = await context.db.from("inspection_findings").insert({
    id: findingId,
    tenant_id: context.tenantId,
    inspection_id: id,
    asset_id: inspection.asset_id,
    item_id: body.itemId ?? null,
    description: body.description.trim(),
    severity: body.severity ?? "medium",
    status: "detected",
    overlay_region: body.overlayRegion ?? null,
  });
  if (insertError) return internalError(insertError);

  void logActivity(context.db, {
    tenantId: context.tenantId,
    actorId: context.userId,
    entityType: "inspection_finding",
    entityId: findingId,
    action: "created",
    metadata: { inspectionId: id, actor: "operator" },
  });

  return NextResponse.json({ data: { id: findingId, status: "detected" } }, { status: 201 });
}
