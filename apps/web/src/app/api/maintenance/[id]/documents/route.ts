import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "maintenance-documents";
const MAX_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const VALID_KINDS = new Set([
  "budget",
  "invoice",
  "work_order",
  "report",
  "receipt",
  "image",
  "warranty",
  "other",
]);

// POST /api/maintenance/:id/documents — multipart upload ("file", "kind").
// Same pattern as api/inspections/:id/media: server-side proxy upload
// (not a signed URL) into a private bucket, one row per file, tenant-
// prefixed path.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.maintenance.update"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: order, error: orderError } = await scope.db
    .from("maintenance_orders")
    .select("id")
    .eq("id", orderId)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (orderError) return internalError(orderError);
  if (!order) return NextResponse.json({ error: "Maintenance order not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 422 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be 10MB or smaller" }, { status: 422 });
  }
  const kindRaw = form.get("kind");
  const kind = typeof kindRaw === "string" && VALID_KINDS.has(kindRaw) ? kindRaw : "other";

  const documentId = crypto.randomUUID();
  const ext = MIME_TO_EXT[file.type];
  const path = `${scope.tenantId}/maintenance/${orderId}/${documentId}.${ext}`;

  const admin = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
  });
  if (uploadError) return internalError(uploadError);

  const { error: insertError } = await scope.db.from("maintenance_documents").insert({
    id: documentId,
    tenant_id: scope.tenantId,
    maintenance_order_id: orderId,
    kind,
    storage_path: path,
    original_filename: file.name || `${documentId}.${ext}`,
    mime_type: file.type,
    uploaded_by: scope.userId,
  });
  if (insertError) {
    await admin.storage.from(BUCKET).remove([path]);
    return internalError(insertError);
  }

  return NextResponse.json({ data: { id: documentId, storagePath: path } }, { status: 201 });
}
