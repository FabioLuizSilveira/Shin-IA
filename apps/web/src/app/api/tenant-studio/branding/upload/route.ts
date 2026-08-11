import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "tenant-branding";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MiB — matches the bucket's file_size_limit
const ALLOWED_KINDS = new Set(["logo", "favicon"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/x-icon": "ico",
};

// POST /api/tenant-studio/branding/upload — multipart form with "file" and
// "kind" ("logo" | "favicon"). Uploaded to the tenant's own folder in the
// public tenant-branding bucket (${tenantId}/${kind}.${ext}, upsert so a
// re-upload replaces the old file instead of accumulating orphans) and
// returns its public URL for the caller to store as
// BrandingConfig.logoUrl/faviconUrl via the existing draft/publish flow.
export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof kind !== "string" || !ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "kind must be 'logo' or 'favicon'" }, { status: 422 });
  }
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported file type — use PNG, JPEG, WebP, SVG or ICO" },
      { status: 422 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 2MB or smaller" }, { status: 422 });
  }

  const admin = createAdminClient();
  const path = `${scope.tenantId}/${kind}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) return internalError(uploadError);

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(path);

  // Cache-bust so the browser/CDN doesn't keep serving the previous file at
  // the same path after a re-upload.
  return NextResponse.json({ data: { url: `${publicUrl}?v=${Date.now()}` } });
}
