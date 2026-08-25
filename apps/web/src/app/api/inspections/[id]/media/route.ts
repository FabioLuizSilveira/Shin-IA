import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "inspection-media";
const MAX_BYTES = 15 * 1024 * 1024; // matches the bucket's file_size_limit
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};
const MIME_TO_MEDIA_TYPE: Record<string, "photo" | "video" | "document"> = {
  "image/png": "photo",
  "image/jpeg": "photo",
  "image/webp": "photo",
  "video/mp4": "video",
  "video/quicktime": "video",
  "application/pdf": "document",
};

// POST /api/inspections/:id/media — multipart form with "file", optional
// "itemId"/"findingId"/"latitude"/"longitude". Unlike
// api/assets/[id]/photo, this NEVER upserts a fixed path — one row per
// file, always a new path (item 7 of the spec: evidence history must be
// immutable, never silently replaced). Checksum is computed server-side
// from the actual bytes, never trusted from the client (item 6: "nunca
// confiar apenas no nome do arquivo" applies equally to any client-
// supplied hash).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const { data: inspection, error: inspectionError } = await scope.db
    .from("inspections")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (inspectionError) return internalError(inspectionError);
  if (!inspection) return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  if (inspection.status !== "draft" && inspection.status !== "in_progress") {
    return NextResponse.json(
      { error: `cannot add media while inspection is ${inspection.status}` },
      { status: 422 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 422 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 15MB or smaller" }, { status: 422 });
  }

  const itemId = form.get("itemId");
  const findingId = form.get("findingId");
  const latitude = form.get("latitude");
  const longitude = form.get("longitude");
  const captureSource = form.get("captureSource");

  // Ownership pre-check for itemId, same discipline as the response route
  // — never trust a client-supplied itemId without verifying it belongs
  // to this inspection's template.
  if (typeof itemId === "string" && itemId) {
    const { data: insp } = await scope.db
      .from("inspections")
      .select("template_id")
      .eq("id", id)
      .maybeSingle();
    const { data: item } = await scope.db
      .from("inspection_template_items")
      .select("id, template_id")
      .eq("id", itemId)
      .maybeSingle();
    if (!item || item.template_id !== insp?.template_id) {
      return NextResponse.json(
        { error: "Item does not belong to this inspection's template" },
        { status: 422 },
      );
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // Real SHA-256 of the raw bytes (never trust a client-supplied hash,
  // never hash a re-encoded representation) — matches what sha256sum on
  // the original file would produce, so it's independently verifiable.
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const checksum = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const mediaId = crypto.randomUUID();
  const path = `${scope.tenantId}/inspections/${id}/${mediaId}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
  });
  if (uploadError) return internalError(uploadError);

  const { error: insertError } = await scope.db.from("inspection_media").insert({
    id: mediaId,
    tenant_id: scope.tenantId,
    inspection_id: id,
    item_id: typeof itemId === "string" && itemId ? itemId : null,
    finding_id: typeof findingId === "string" && findingId ? findingId : null,
    media_type: MIME_TO_MEDIA_TYPE[file.type],
    storage_path: path,
    original_filename: file.name || `${mediaId}.${ext}`,
    mime_type: file.type,
    size_bytes: file.size,
    checksum_sha256: checksum,
    captured_by: scope.userId,
    latitude: typeof latitude === "string" && latitude ? Number(latitude) : null,
    longitude: typeof longitude === "string" && longitude ? Number(longitude) : null,
    capture_source:
      typeof captureSource === "string" && captureSource ? captureSource : "mobile_camera",
  });
  if (insertError) {
    // Insert failed after the bytes already landed in storage — clean up
    // rather than leaving an orphaned object with no DB row pointing at
    // it (the row is the source of truth for what exists).
    await admin.storage.from(BUCKET).remove([path]);
    return internalError(insertError);
  }

  return NextResponse.json({ data: { id: mediaId, storagePath: path } }, { status: 201 });
}
