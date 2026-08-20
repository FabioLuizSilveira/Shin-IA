import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "asset-photos";
const MAX_BYTES = 4 * 1024 * 1024; // 4 MiB — matches the bucket's file_size_limit
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// POST /api/assets/[id]/photo — multipart form with "file". Same
// upload-then-store-public-url pattern as
// api/tenant-studio/branding/upload/route.ts: the file goes to the public
// asset-photos bucket at ${tenantId}/${assetId}.${ext} (upsert so
// re-uploading replaces the old photo instead of accumulating orphans),
// and the resulting URL is merged into assets.metadata.photo_url —
// merged, not overwritten, since metadata may already carry other fields
// (weekly_rate, etc., see the Veloz demo seed).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const { id } = await params;
  const { data: asset, error: assetError } = await scope.db
    .from("assets")
    .select("id, metadata")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (assetError) return internalError(assetError);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported file type — use PNG, JPEG or WebP" },
      { status: 422 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 4MB or smaller" }, { status: 422 });
  }

  const admin = createAdminClient();
  const path = `${scope.tenantId}/${id}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return internalError(uploadError);

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);
  const photoUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await scope.db
    .from("assets")
    .update({ metadata: { ...(asset.metadata as object), photo_url: photoUrl } })
    .eq("id", id);
  if (updateError) return internalError(updateError);

  return NextResponse.json({ data: { photo_url: photoUrl } });
}
