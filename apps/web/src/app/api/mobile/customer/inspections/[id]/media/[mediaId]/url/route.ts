import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "inspection-media";
const SIGNED_URL_TTL_SECONDS = 300;

// GET /api/mobile/customer/inspections/:id/media/:mediaId/url — the
// bucket stays private (item 9 of the spec: never make it public to
// make sharing easier). Same pattern as
// customer-contracts/[id]/documents/[documentId]/url — ownership proven
// by the query itself (inspection_id + customer_id both matched), a
// short-lived signed URL is the only thing ever handed to the browser.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const { id, mediaId } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await context.db
    .from("inspections")
    .select("id")
    .eq("id", id)
    .eq("customer_id", context.customerId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const { data: media, error: mediaError } = await context.db
    .from("inspection_media")
    .select("storage_path")
    .eq("id", mediaId)
    .eq("inspection_id", id)
    .maybeSingle();
  if (mediaError) return internalError(mediaError);
  if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(media.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) return internalError(signError ?? new Error("failed to sign url"));

  return NextResponse.json({ data: { url: signed.signedUrl } });
}
