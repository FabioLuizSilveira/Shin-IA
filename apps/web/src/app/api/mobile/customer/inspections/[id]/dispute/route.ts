import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";

export const dynamic = "force-dynamic";

interface DisputeBody {
  itemId?: string | null;
  description?: string;
}

// POST /api/mobile/customer/inspections/:id/dispute — "REGISTRAR
// DIVERGÊNCIA" (item 5 of the spec). Deliberately its own small entity
// (inspection_disputes), not a Finding — a customer's "eu não concordo"
// is a claim to be reviewed by staff, not yet a technical avaria with a
// severity/cost a billing hook could act on. See decision 2 in
// INSPECTION_PRODUCTION_COMPLETION_PLAN.md.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await context.db
    .from("inspections")
    .select("id, tenant_id, status, template_id")
    .eq("id", id)
    .eq("customer_id", context.customerId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (inspection.status !== "pending_review" && inspection.status !== "completed") {
    return NextResponse.json(
      { error: "Esta vistoria ainda não está disponível para revisão." },
      { status: 422 },
    );
  }

  const body = (await req.json()) as DisputeBody;
  if (!body.description || !body.description.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  if (body.itemId) {
    const { data: item } = await context.db
      .from("inspection_template_items")
      .select("id, template_id")
      .eq("id", body.itemId)
      .maybeSingle();
    if (!item || item.template_id !== inspection.template_id) {
      return NextResponse.json(
        { error: "Item does not belong to this inspection's template" },
        { status: 422 },
      );
    }
  }

  const disputeId = crypto.randomUUID();
  const { error: insertError } = await context.db.from("inspection_disputes").insert({
    id: disputeId,
    tenant_id: inspection.tenant_id,
    inspection_id: id,
    item_id: body.itemId ?? null,
    customer_id: context.customerId,
    description: body.description.trim(),
    status: "open",
  });
  if (insertError) return internalError(insertError);

  void logActivity(context.db, {
    tenantId: inspection.tenant_id,
    actorId: context.userId,
    entityType: "inspection",
    entityId: id,
    action: "disputed",
    metadata: { disputeId, itemId: body.itemId ?? null },
  });

  void createNotification({
    tenantId: inspection.tenant_id,
    subject: "Cliente contestou a vistoria",
    body: "O cliente registrou uma divergência que precisa de revisão.",
    priority: "high",
  });

  return NextResponse.json({ data: { id: disputeId } }, { status: 201 });
}
