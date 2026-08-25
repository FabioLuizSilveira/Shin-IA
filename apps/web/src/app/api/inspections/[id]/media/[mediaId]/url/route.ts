import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope } from "@/lib/tenant-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "inspection-media";
const SIGNED_URL_TTL_SECONDS = 300;

// GET /api/inspections/:id/media/:mediaId/url — staff-side equivalent of
// the customer route with the same name under api/mobile/customer.
// inspection-media has no reader route at all before this (upload-only) —
// the web Inspection Builder/detail drawer needs this to actually show
// captured photos instead of just filenames.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const { id, mediaId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: media, error: mediaError } = await scope.db
    .from("inspection_media")
    .select("storage_path")
    .eq("id", mediaId)
    .eq("inspection_id", id)
    .eq("tenant_id", scope.tenantId)
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
