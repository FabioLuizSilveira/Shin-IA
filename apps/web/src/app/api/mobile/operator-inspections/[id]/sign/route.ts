import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { logActivity } from "@/lib/activity-log";
import { clientIp } from "@/lib/rate-limit";
import { hashContent } from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

// POST /api/mobile/operator-inspections/:id/sign — operator's checklist
// sign-off (item 15 of the spec: "operador assina" happens right after
// finishing the checklist, before the customer is even presented with
// anything — well before a formal laudo exists, since that only gets
// generated once staff marks the inspection "completed"). Unlike
// api/inspections/[id]/sign (tenant_staff, requires an existing report),
// this signs over a hash of the checklist state *as submitted*
// (responses + media checksums), not a report_id — inspection_signatures.
// report_id was made nullable in 20260102000000 exactly for this case.
// accepted_at/ip_address/user_agent are always backend-stamped, same rule
// as every acceptance table in this codebase.
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
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", context.tenantId)
    .eq("operator_id", context.operatorId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (inspection.status !== "pending_review" && inspection.status !== "completed") {
    return NextResponse.json(
      { error: "Envie a vistoria para revisão antes de assinar." },
      { status: 422 },
    );
  }

  const [{ data: responses, error: responsesError }, { data: media, error: mediaError }] =
    await Promise.all([
      context.db
        .from("inspection_responses")
        .select("item_id, value_text, value_number, value_boolean, value_json, notes")
        .eq("inspection_id", id)
        .order("item_id", { ascending: true }),
      context.db
        .from("inspection_media")
        .select("id, item_id, checksum_sha256")
        .eq("inspection_id", id)
        .order("id", { ascending: true }),
    ]);
  if (responsesError) return internalError(responsesError);
  if (mediaError) return internalError(mediaError);

  // If a formal report already exists (inspection was completed after
  // this operator submitted it once before, e.g. re-signing), sign over
  // that instead — it's the more authoritative artifact once it exists.
  const { data: report } = await context.db
    .from("inspection_reports")
    .select("id, content_hash")
    .eq("inspection_id", id)
    .eq("tenant_id", context.tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const documentHash = report
    ? report.content_hash
    : await hashContent(JSON.stringify({ responses: responses ?? [], media: media ?? [] }));

  const signatureId = crypto.randomUUID();
  const { error: insertError } = await context.db.from("inspection_signatures").insert({
    id: signatureId,
    tenant_id: context.tenantId,
    inspection_id: id,
    report_id: report?.id ?? null,
    signer_type: "operator",
    operator_id: context.operatorId,
    user_id: context.userId,
    ip_address: clientIp(req),
    user_agent: req.headers.get("user-agent") ?? null,
    document_hash: documentHash,
    acceptance_method: "clickwrap",
  });
  if (insertError) return internalError(insertError);

  void logActivity(context.db, {
    tenantId: context.tenantId,
    actorId: context.userId,
    entityType: "inspection",
    entityId: id,
    action: "signed",
    metadata: { signerType: "operator", operatorId: context.operatorId },
  });

  return NextResponse.json({ data: { id: signatureId, documentHash } }, { status: 201 });
}
