import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/verify/inspection-report/:token — item 8 of the spec. Public,
// unauthenticated by design (that's the point of a QR code on a printed
// document), but returns only the minimal metadata shown in the spec's
// own example — never media, never personal data, never the rendered
// checklist. verification_token is a distinct, high-entropy value from
// inspection_report_shares.token_hash (never sequential — that's the
// explicit rule in item 8): knowing it only proves you saw the printed
// PDF or its QR code, it grants no access to anything else.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: report } = await admin
    .from("inspection_reports")
    .select("id, inspection_id, version, content_hash, generated_at")
    .eq("verification_token", token)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ data: { valid: false } });
  }

  return NextResponse.json({
    data: {
      valid: true,
      inspectionCode: `VIS-${report.inspection_id.slice(0, 8).toUpperCase()}`,
      version: report.version,
      generatedAt: report.generated_at,
      hash: report.content_hash,
      status: "Documento original",
    },
  });
}
