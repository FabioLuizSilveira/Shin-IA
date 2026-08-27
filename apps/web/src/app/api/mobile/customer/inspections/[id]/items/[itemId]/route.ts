import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";

export const dynamic = "force-dynamic";

interface UpsertResponseBody {
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
  valueJson?: unknown;
  notes?: string | null;
}

// PATCH /api/mobile/customer/inspections/:id/items/:itemId — customer's
// self-service equivalent of the operator/staff items routes. Gated on
// metadata.selfService === true in addition to customer_id ownership —
// a customer never gets to edit the checklist of an inspection staff or
// an operator is filling out, even one that references their
// customer_id for review/tracking purposes.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await context.db
    .from("inspections")
    .select("id, tenant_id, status, template_id, metadata")
    .eq("id", id)
    .eq("customer_id", context.customerId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  const metadata = inspection.metadata as { selfService?: boolean } | null;
  if (!metadata?.selfService) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (inspection.status !== "draft" && inspection.status !== "in_progress") {
    return NextResponse.json(
      { error: `cannot edit responses while inspection is ${inspection.status}` },
      { status: 422 },
    );
  }

  const { data: item, error: itemError } = await context.db
    .from("inspection_template_items")
    .select("id, template_id")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError) return internalError(itemError);
  if (!item || item.template_id !== inspection.template_id) {
    return NextResponse.json(
      { error: "Item does not belong to this inspection's template" },
      { status: 422 },
    );
  }

  const body = (await req.json()) as UpsertResponseBody;

  const { error: upsertError } = await context.db.from("inspection_responses").upsert(
    {
      tenant_id: inspection.tenant_id,
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
