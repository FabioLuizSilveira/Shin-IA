import type { AgentTool } from "../tool-types";
import { runEmbeddingGateway } from "@shina/ai-gateway";

interface MatchRow {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  content: string;
  trust_level: string;
  similarity: number;
}

// The retriever: embeds the query, then calls match_tenant_knowledge_chunks
// (a Postgres function, see the Wave 5 migration) which does the actual
// cosine-similarity ranking WITH tenant_id as a hard SQL filter — isolation
// lives in that function's WHERE clause, not in anything this tool code
// could get wrong. Every returned chunk carries document_title +
// chunk_index (the provenance/citation the spec's Wave 5 section requires)
// and trust_level (the taint primitive Wave 6's exfiltration policy will
// check — nothing consumes it yet, since no external-action tool exists
// before Wave 6, but it's already on every result here).
export const searchTenantKnowledgeTool: AgentTool<{ query: string }> = {
  name: "search_tenant_knowledge",
  description:
    "Busca por trechos relevantes na base de conhecimento do tenant (documentos internos cadastrados) para responder uma pergunta.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Pergunta ou termo de busca" },
    },
    required: ["query"],
  },
  requiredPermission: "tenant.knowledge.view",
  requiredFeature: "agent.tools.knowledge",
  async execute(args, ctx, scope) {
    if (!args.query?.trim()) return { ok: false, error: "query is required" };

    let embeddings: number[][];
    try {
      const result = await runEmbeddingGateway({
        db: scope.db,
        adminDb: scope.db,
        ctx: { workspaceId: ctx.workspaceId, tenantId: scope.tenantId, userId: scope.userId },
        operation: "knowledge_search",
        entityType: "tenant_knowledge_query",
        input: [args.query.trim()],
      });
      embeddings = result.embeddings;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (!embeddings[0]) return { ok: false, error: "failed to embed query" };

    const { data, error } = await scope.db.rpc("match_tenant_knowledge_chunks", {
      p_tenant_id: scope.tenantId,
      p_query_embedding: embeddings[0],
      p_match_count: 5,
    });
    if (error) return { ok: false, error: error.message };

    const rows = (data ?? []) as MatchRow[];
    return {
      ok: true,
      data: rows.map((r) => ({
        content: r.content,
        similarity: r.similarity,
        source: { documentTitle: r.document_title, chunkIndex: r.chunk_index },
        trustLevel: r.trust_level,
      })),
    };
  },
};
