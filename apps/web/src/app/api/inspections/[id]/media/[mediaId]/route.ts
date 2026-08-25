import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

interface PatchMediaBody {
  findingId?: string | null;
}

// PATCH /api/inspections/:id/media/:mediaId — links a photo to the
// finding it evidences the damage overlay for (item 11 of the spec:
// "Marcar avaria" on a photo). Per the architecture decision in
// INSPECTION_PRODUCTION_COMPLETION_PLAN.md §3.1, overlay_region lives on
// inspection_findings, not inspection_media — this route is what makes a
// photo "the one" a finding's overlay was drawn on.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const { id, mediaId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.review_damage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: media, error: mediaError } = await scope.db
    .from("inspection_media")
    .select("id")
    .eq("id", mediaId)
    .eq("inspection_id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (mediaError) return internalError(mediaError);
  if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  const body = (await req.json()) as PatchMediaBody;
  if (body.findingId) {
    const { data: finding } = await scope.db
      .from("inspection_findings")
      .select("id")
      .eq("id", body.findingId)
      .eq("inspection_id", id)
      .eq("tenant_id", scope.tenantId)
      .maybeSingle();
    if (!finding) return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  const { error: updateError } = await scope.db
    .from("inspection_media")
    .update({ finding_id: body.findingId ?? null })
    .eq("id", mediaId)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  return NextResponse.json({ data: { ok: true } });
}
