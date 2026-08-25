import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";

export const dynamic = "force-dynamic";

interface PatchMediaBody {
  findingId?: string | null;
}

// PATCH /api/mobile/operator-inspections/:id/media/:mediaId — operator's
// equivalent of api/inspections/:id/media/:mediaId. Links a photo to the
// finding it evidences the damage overlay for (item 11/12 of the spec —
// same architecture decision as the web version: overlay_region lives on
// inspection_findings, this route is what makes a specific photo "the
// one" a finding's overlay was drawn on). Ownership re-verified via
// operator_id, never trusted from the URL alone.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const { id, mediaId } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await context.db
    .from("inspections")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", context.tenantId)
    .eq("operator_id", context.operatorId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });

  const { data: media, error: mediaError } = await context.db
    .from("inspection_media")
    .select("id")
    .eq("id", mediaId)
    .eq("inspection_id", id)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();
  if (mediaError) return internalError(mediaError);
  if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  const body = (await req.json()) as PatchMediaBody;
  if (body.findingId) {
    const { data: finding } = await context.db
      .from("inspection_findings")
      .select("id")
      .eq("id", body.findingId)
      .eq("inspection_id", id)
      .eq("tenant_id", context.tenantId)
      .maybeSingle();
    if (!finding) return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  const { error: updateError } = await context.db
    .from("inspection_media")
    .update({ finding_id: body.findingId ?? null })
    .eq("id", mediaId)
    .eq("tenant_id", context.tenantId);
  if (updateError) return internalError(updateError);

  return NextResponse.json({ data: { ok: true } });
}
