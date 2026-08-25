import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInspectionPdfInput } from "@/lib/inspection-report-data";
import { renderInspectionReportPdf } from "@/lib/inspection-pdf";
import { logActivity } from "@/lib/activity-log";
import { hashContent } from "@shina/inspection-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/share/inspection-report/:token — the ONLY unauthenticated
// route that can return a full laudo PDF (item 9 of the spec). Deliberately
// separate from /verify/... (item 8), which never returns the document
// itself. Token is compared by hash (never stored in clear — see
// 20260102000000), and expired/revoked tokens are rejected with the same
// generic 404 as an unknown token, so this endpoint never leaks which
// case applies.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const tokenHash = await hashContent(token);

  const { data: share, error } = await admin
    .from("inspection_report_shares")
    .select("id, tenant_id, report_id, inspection_id, expires_at, revoked_at, access_count")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) return internalError(error);
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (share.revoked_at || new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdfInput = await buildInspectionPdfInput(admin, share.report_id);
  if (!pdfInput) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderInspectionReportPdf(pdfInput);

  void admin
    .from("inspection_report_shares")
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: share.access_count + 1,
    })
    .eq("id", share.id);

  // actor_id is a not-null uuid column — there's no authenticated user
  // for a public link click, so a fixed nil-UUID sentinel records "public
  // access" without failing the uuid cast (a string like "anonymous"
  // would silently fail the insert and never actually reach the audit
  // trail — item 18 of the spec requires "link acessado" to be real).
  void logActivity(admin, {
    tenantId: share.tenant_id,
    actorId: "00000000-0000-0000-0000-000000000000",
    entityType: "inspection",
    entityId: share.inspection_id,
    action: "report_share_accessed",
    metadata: { shareId: share.id },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vistoria.pdf"`,
    },
  });
}
