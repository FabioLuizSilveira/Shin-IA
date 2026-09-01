import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { sanitizeDocumentDraft } from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

// PATCH /api/maintenance/documents/:id/confirm (Etapa 12, P1) — the
// human-in-the-loop half: a staff member reviews the extracted draft
// (editing any field first, if needed) and confirms it. This is the only
// route in the Document AI pipeline that can mark extraction_status
// "confirmed", and it deliberately still does NOT write anything to the
// parent maintenance_orders row -- the confirmed draft becomes the
// document's own permanent record (an audit trail of what a human
// verified against the source file), not an automatic mutation of order
// fields. Staff still edits the order itself via the existing PATCH
// /api/maintenance/:id route, informed by (but not driven by) this data.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.maintenance.documents_extract"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: document, error: fetchError } = await scope.db
    .from("maintenance_documents")
    .select("id, extraction_status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (document.extraction_status !== "extracted") {
    return NextResponse.json(
      { error: `cannot confirm a document with extraction_status "${document.extraction_status}"` },
      { status: 422 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as unknown;
  // The human may have edited the draft in the UI before confirming --
  // sanitize whatever they submit exactly like the model's own output,
  // same anti-hallucination-adjacent discipline: never trust client input
  // into a jsonb column without type/shape validation either.
  const finalDraft = sanitizeDocumentDraft(body);

  const { error: updateError } = await scope.db
    .from("maintenance_documents")
    .update({
      extraction_status: "confirmed",
      extraction_draft: finalDraft,
      confirmed_by: scope.userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  return NextResponse.json({ data: { ok: true, draft: finalDraft } });
}
