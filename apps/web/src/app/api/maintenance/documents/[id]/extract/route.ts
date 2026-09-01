import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";
import { sanitizeDocumentDraft, computeExtractionCompleteness } from "@shina/maintenance-engine";

export const dynamic = "force-dynamic";

// POST /api/maintenance/documents/:id/extract (Etapa 12, P1) — triggers
// the extract-maintenance-document Edge Function and stores the result
// as a draft awaiting human confirmation. Never applies anything to the
// parent maintenance_orders row -- see the migration's comment for why.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.maintenance.documents_extract"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: document, error: fetchError } = await scope.db
    .from("maintenance_documents")
    .select("id, storage_path, mime_type")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!document.mime_type) {
    return NextResponse.json(
      { error: "Document has no recorded mime type (uploaded before this feature existed)" },
      { status: 422 },
    );
  }

  await scope.db
    .from("maintenance_documents")
    .update({ extraction_status: "pending", extraction_error: null })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const sessionClient = await createClient();
  const {
    data: { session },
  } = await sessionClient.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const fnRes = await fetch(`${supabaseUrl}/functions/v1/extract-maintenance-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storagePath: document.storage_path, mimeType: document.mime_type }),
    });
    const json = (await fnRes.json()) as { draft?: unknown; model?: string; error?: string };

    if (!fnRes.ok || json.error || !json.draft) {
      await scope.db
        .from("maintenance_documents")
        .update({
          extraction_status: "failed",
          extraction_error: json.error ?? "Extraction failed",
        })
        .eq("id", id)
        .eq("tenant_id", scope.tenantId);
      return NextResponse.json({ error: json.error ?? "Extraction failed" }, { status: 502 });
    }

    // Never trust the edge function's raw JSON either, even though it
    // already went through one parse there -- sanitize again here, the
    // second of two independent layers (see document-ai.ts).
    const draft = sanitizeDocumentDraft(json.draft);
    const completeness = computeExtractionCompleteness(draft);

    const { error: updateError } = await scope.db
      .from("maintenance_documents")
      .update({
        extraction_status: "extracted",
        extraction_draft: draft,
        extraction_confidence: completeness,
        extraction_model: json.model ?? null,
        extracted_at: new Date().toISOString(),
        extraction_error: null,
      })
      .eq("id", id)
      .eq("tenant_id", scope.tenantId);
    if (updateError) return internalError(updateError);

    return NextResponse.json({ data: { draft, completeness } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    await scope.db
      .from("maintenance_documents")
      .update({ extraction_status: "failed", extraction_error: msg })
      .eq("id", id)
      .eq("tenant_id", scope.tenantId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
