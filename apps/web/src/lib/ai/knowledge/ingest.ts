import type { TenantScope } from "@/lib/tenant-context";
import { runEmbeddingGateway } from "@shina/ai-gateway";
import { ensureDefaultAgentWorkspace } from "@/lib/ai/workspace";
import { chunkText } from "./chunking";

const MAX_CONTENT_CHARS = 200_000;

export interface IngestResult {
  documentId: string;
  chunkCount: number;
}

// Wave 5's first cut: plain text/markdown only (no OCR/PDF pipeline exists
// anywhere in this codebase — confirmed by audit — so this deliberately
// does not attempt one). trust_level is fixed to "trusted_staff_upload"
// here because the only ingestion path today IS a tenant staff member
// pasting/uploading text through an authenticated, permissioned route —
// an "untrusted_external" path (e.g. OCR output, customer-submitted text)
// would be a distinct ingestion function with its own explicit taint,
// never this same call defaulted to trusted.
export async function ingestKnowledgeDocument(
  scope: TenantScope,
  input: { title: string; content: string },
): Promise<IngestResult> {
  const content = input.content.trim().slice(0, MAX_CONTENT_CHARS);
  if (!content) throw new Error("content is empty");

  const { data: doc, error: insertError } = await scope.db
    .from("tenant_knowledge_documents")
    .insert({
      tenant_id: scope.tenantId,
      title: input.title.trim() || "Sem título",
      trust_level: "trusted_staff_upload",
      status: "processing",
      content_char_count: content.length,
      created_by: scope.userId,
    })
    .select("id")
    .single();
  if (insertError || !doc) throw insertError ?? new Error("failed to create knowledge document");

  const documentId = doc.id as string;
  const chunks = chunkText(content);
  if (chunks.length === 0) {
    await scope.db
      .from("tenant_knowledge_documents")
      .update({ status: "failed", error: "no extractable content" })
      .eq("id", documentId)
      .eq("tenant_id", scope.tenantId);
    throw new Error("no extractable content");
  }

  try {
    const workspaceId = await ensureDefaultAgentWorkspace(scope.db, scope.tenantId);
    const { embeddings } = await runEmbeddingGateway({
      db: scope.db,
      adminDb: scope.db,
      ctx: { workspaceId, tenantId: scope.tenantId, userId: scope.userId },
      operation: "knowledge_ingest",
      entityType: "tenant_knowledge_document",
      input: chunks,
    });

    const rows = chunks.map((content, i) => ({
      tenant_id: scope.tenantId,
      document_id: documentId,
      chunk_index: i,
      content,
      trust_level: "trusted_staff_upload",
      embedding: embeddings[i],
      token_count: Math.ceil(content.length / 4),
    }));
    const { error: chunksError } = await scope.db.from("tenant_knowledge_chunks").insert(rows);
    if (chunksError) throw chunksError;

    await scope.db
      .from("tenant_knowledge_documents")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", documentId)
      .eq("tenant_id", scope.tenantId);

    return { documentId, chunkCount: rows.length };
  } catch (err) {
    await scope.db
      .from("tenant_knowledge_documents")
      .update({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .eq("tenant_id", scope.tenantId);
    throw err;
  }
}
