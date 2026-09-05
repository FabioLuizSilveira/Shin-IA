import type { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbeddingsOpenAI } from "./openai.js";
import { estimateCredits } from "./cost-policy.js";
import { consumeCredits, getCreditBalance, InsufficientCreditsError } from "./credits.js";

const EMBEDDING_MODEL = "text-embedding-3-small";

interface EmbeddingGatewayInput {
  /** Session-scoped client, used for the usage insert + credit RPC (same
   * split as runAiGateway's db/adminDb — apps/web passes its single admin
   * client for both, it already bypasses RLS by construction). */
  db: SupabaseClient;
  /** Admin/service-role client — model cost policy has no RLS for
   * `authenticated`, matching runAiGateway's own requirement. */
  adminDb: SupabaseClient;
  ctx: { workspaceId: string; tenantId: string; userId: string };
  operation: string;
  entityType?: string;
  input: string[];
}

interface EmbeddingGatewayResult {
  embeddings: number[][];
  model: string;
  tokensIn: number;
  creditsConsumed: number | null;
}

// Wave 5's own funnel, mirroring runAiGateway's shape (credit pre-check →
// provider call → usage metering → ledger debit) but for the embeddings
// endpoint's different request/response contract. The Shinã Agent Platform
// is SHINA-exclusive by product decision (no BYOK path exists for it, same
// as the messages/tool-calling path in gateway.ts) — this function has no
// credentialMode parameter because there is only ever one mode here.
export async function runEmbeddingGateway(
  input: EmbeddingGatewayInput,
): Promise<EmbeddingGatewayResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY não configurada. Configure a variável de ambiente no servidor.",
    );
  }

  // Conservative pre-check: ~4 chars/token is a standard rough estimate,
  // good enough for a guard rail (the real debit below uses the actual
  // token count OpenAI reports, never this estimate).
  const estimatedTokens = input.input.reduce((sum, s) => sum + Math.ceil(s.length / 4), 0);
  const preCheck = await estimateCredits(input.adminDb, {
    provider: "openai",
    model: EMBEDDING_MODEL,
    capability: "embedding",
    tokensIn: estimatedTokens,
    tokensOut: 0,
  });
  if (preCheck) {
    const balance = await getCreditBalance(input.db, input.ctx.workspaceId);
    if (balance < preCheck.credits) {
      throw new InsufficientCreditsError(preCheck.credits, balance);
    }
  }

  const started = Date.now();
  const result = await generateEmbeddingsOpenAI({ input: input.input, apiKey });
  const durationMs = Date.now() - started;

  const actual = await estimateCredits(input.adminDb, {
    provider: "openai",
    model: result.model,
    capability: "embedding",
    tokensIn: result.tokensIn,
    tokensOut: 0,
  });
  const creditsConsumed = actual?.credits ?? null;

  const { data: usageRow, error: usageError } = await input.db
    .from("ai_gateway_usage")
    .insert({
      workspace_id: input.ctx.workspaceId,
      tenant_id: input.ctx.tenantId,
      user_id: input.ctx.userId,
      provider: "openai",
      model: result.model,
      operation: input.operation,
      tokens_in: result.tokensIn,
      tokens_out: 0,
      duration_ms: durationMs,
      entity_type: input.entityType ?? null,
      credential_source: "SHINA",
      billing_source: "SHINA_CREDITS",
      credits_consumed: creditsConsumed,
      estimated_cost_usd: actual?.costUsd ?? null,
    })
    .select("id")
    .single();
  if (usageError || !usageRow) throw usageError ?? new Error("failed to record ai usage");

  if (creditsConsumed !== null) {
    try {
      await consumeCredits(input.db, {
        workspaceId: input.ctx.workspaceId,
        tenantId: input.ctx.tenantId,
        credits: creditsConsumed,
        usageId: usageRow.id as string,
        metadata: { operation: input.operation, model: result.model },
      });
    } catch (err) {
      // Same known-limitation posture as runAiGateway: the provider was
      // already called, throwing away the embeddings over a metering race
      // would be worse than a logged, non-fatal miss.
      console.error("[ai-gateway] embedding credit deduction failed post-call", err);
    }
  }

  return {
    embeddings: result.embeddings,
    model: result.model,
    tokensIn: result.tokensIn,
    creditsConsumed,
  };
}
