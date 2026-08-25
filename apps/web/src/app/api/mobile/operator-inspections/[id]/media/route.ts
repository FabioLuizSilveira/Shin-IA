import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "inspection-media";
const MAX_BYTES = 15 * 1024 * 1024;
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

// POST /api/mobile/operator-inspections/:id/media — operator's equivalent
// of api/inspections/:id/media, scoped to inspections assigned to this
// operator. Same discipline as the staff route: server-computed SHA-256,
// never a fixed/upserted path, ownership of itemId re-verified server-side.
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
    .select("id, status, template_id")
    .eq("id", id)
    .eq("tenant_id", context.tenantId)
    .eq("operator_id", context.operatorId)
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
  if (!ext) return NextResponse.json({ error: "Unsupported file type" }, { status: 422 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 15MB or smaller" }, { status: 422 });
  }

  const itemId = form.get("itemId");
  const findingId = form.get("findingId");
  const latitude = form.get("latitude");
  const longitude = form.get("longitude");

  if (typeof itemId === "string" && itemId) {
    const { data: item } = await context.db
      .from("inspection_template_items")
      .select("id, template_id")
      .eq("id", itemId)
      .maybeSingle();
    if (!item || item.template_id !== inspection.template_id) {
      return NextResponse.json(
        { error: "Item does not belong to this inspection's template" },
        { status: 422 },
      );
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const checksum = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Idempotency: a mobile upload retried after a dropped connection (item
  // 20/21 of the spec — offline hardening) must not create a duplicate
  // media row. The checksum is content-derived, so a byte-identical retry
  // of the same capture always produces the same value — checking it
  // before uploading again is a real idempotency key, not a client-trusted
  // one.
  const { data: existing } = await context.db
    .from("inspection_media")
    .select("id, storage_path")
    .eq("inspection_id", id)
    .eq("checksum_sha256", checksum)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { data: { id: existing.id, storagePath: existing.storage_path, deduplicated: true } },
      { status: 200 },
    );
  }

  const mediaId = crypto.randomUUID();
  const path = `${context.tenantId}/inspections/${id}/${mediaId}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
  });
  if (uploadError) return internalError(uploadError);

  const { error: insertError } = await context.db.from("inspection_media").insert({
    id: mediaId,
    tenant_id: context.tenantId,
    inspection_id: id,
    item_id: typeof itemId === "string" && itemId ? itemId : null,
    finding_id: typeof findingId === "string" && findingId ? findingId : null,
    media_type: MIME_TO_MEDIA_TYPE[file.type],
    storage_path: path,
    original_filename: file.name || `${mediaId}.${ext}`,
    mime_type: file.type,
    size_bytes: file.size,
    checksum_sha256: checksum,
    captured_by: context.userId,
    latitude: typeof latitude === "string" && latitude ? Number(latitude) : null,
    longitude: typeof longitude === "string" && longitude ? Number(longitude) : null,
    capture_source: "mobile_camera",
  });
  if (insertError) {
    await admin.storage.from(BUCKET).remove([path]);
    return internalError(insertError);
  }

  return NextResponse.json({ data: { id: mediaId, storagePath: path } }, { status: 201 });
}
