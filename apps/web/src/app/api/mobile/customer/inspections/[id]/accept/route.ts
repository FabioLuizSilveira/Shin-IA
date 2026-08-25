import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { clientIp } from "@/lib/rate-limit";
import { hashContent } from "@shina/inspection-engine";

export const dynamic = "force-dynamic";

// POST /api/mobile/customer/inspections/:id/accept — "CONCORDO" (item 4 of
// the spec). Same non-negotiable rule as every other acceptance table in
// this codebase: accepted_at/ip_address/user_agent are ALWAYS stamped by
// the backend, never accepted from the request body. Idempotent by
// design — re-posting doesn't error, it just records another signature
// row (signed_at differs), matching how re-signing a contract works.
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
    .select("id, tenant_id, status")
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

  const [{ data: responses }, { data: media }, { data: report }] = await Promise.all([
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
    context.db
      .from("inspection_reports")
      .select("id, content_hash")
      .eq("inspection_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const documentHash = report
    ? report.content_hash
    : await hashContent(JSON.stringify({ responses: responses ?? [], media: media ?? [] }));

  const signatureId = crypto.randomUUID();
  const { error: insertError } = await context.db.from("inspection_signatures").insert({
    id: signatureId,
    tenant_id: inspection.tenant_id,
    inspection_id: id,
    report_id: report?.id ?? null,
    signer_type: "customer",
    customer_id: context.customerId,
    user_id: context.userId,
    ip_address: clientIp(req),
    user_agent: req.headers.get("user-agent") ?? null,
    document_hash: documentHash,
    acceptance_method: "clickwrap",
  });
  if (insertError) return internalError(insertError);

  void logActivity(context.db, {
    tenantId: inspection.tenant_id,
    actorId: context.userId,
    entityType: "inspection",
    entityId: id,
    action: "accepted",
    metadata: { signerType: "customer", customerId: context.customerId },
  });

  void createNotification({
    tenantId: inspection.tenant_id,
    subject: "Vistoria aceita pelo cliente",
    body: "O cliente confirmou o aceite da vistoria digital.",
    priority: "normal",
  });

  return NextResponse.json({ data: { id: signatureId, documentHash } }, { status: 201 });
}
