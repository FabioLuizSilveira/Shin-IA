import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { createInspectionTemplateRepository } from "@/lib/inspection-repository";

export const dynamic = "force-dynamic";

const SELECT =
  "id, tenant_id, asset_id, contract_id, type, status, linked_inspection_id, started_at, completed_at, created_at, template_id";

// GET /api/mobile/customer/inspections/:id — a customer only reaches
// "review this inspection" once the operator has actually submitted it
// (pending_review/completed); before that there's nothing coherent to
// show them yet. Cost/billing fields on findings are never exposed here
// — a customer sees what was found, not what the tenant is planning to
// charge for it (that's still a staff decision behind review_damage).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error } = await context.db
    .from("inspections")
    .select(SELECT)
    .eq("id", id)
    .eq("customer_id", context.customerId)
    .maybeSingle();
  if (error) return internalError(error);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const [
    { data: responses, error: responsesError },
    { data: media, error: mediaError },
    { data: findings, error: findingsError },
    { data: report },
    { data: disputes, error: disputesError },
  ] = await Promise.all([
    context.db
      .from("inspection_responses")
      .select("item_id, value_text, value_number, value_boolean, value_json, notes")
      .eq("inspection_id", id),
    context.db
      .from("inspection_media")
      .select("id, item_id, finding_id, media_type, storage_path, captured_at, sort_order")
      .eq("inspection_id", id)
      .order("sort_order", { ascending: true }),
    context.db
      .from("inspection_findings")
      .select("id, item_id, description, severity, status, preexisting_finding_id, overlay_region")
      .eq("inspection_id", id),
    context.db
      .from("inspection_reports")
      .select("id, version, content_hash, generated_at")
      .eq("inspection_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from("inspection_disputes")
      .select("id, item_id, description, status, created_at, resolution_notes")
      .eq("inspection_id", id)
      .eq("customer_id", context.customerId)
      .order("created_at", { ascending: false }),
  ]);
  if (responsesError) return internalError(responsesError);
  if (mediaError) return internalError(mediaError);
  if (findingsError) return internalError(findingsError);
  if (disputesError) return internalError(disputesError);

  const { data: acceptance } = await context.db
    .from("inspection_signatures")
    .select("id, signed_at")
    .eq("inspection_id", id)
    .eq("signer_type", "customer")
    .eq("customer_id", context.customerId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const repo = createInspectionTemplateRepository(context.db);
  const template = await repo.getHydratedTemplateById(inspection.template_id);

  return NextResponse.json({
    data: {
      inspection,
      template,
      responses: responses ?? [],
      media: media ?? [],
      findings: findings ?? [],
      report: report ?? null,
      disputes: disputes ?? [],
      acceptance: acceptance ?? null,
      canReview: inspection.status === "pending_review" || inspection.status === "completed",
    },
  });
}
