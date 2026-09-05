import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAnthropicKey } from "./byok.js";
import { resolveAiPolicy } from "./policy.js";
import { estimateCredits, estimateMaxCredits } from "./cost-policy.js";
import { consumeCredits, getCreditBalance, InsufficientCreditsError } from "./credits.js";
import { getModelProviderRegistry } from "./registry.js";
import { analyzeImage, AIProviderError } from "./anthropic.js";
import { generateWithMessagesOpenAI } from "./openai.js";
import type { OpenAiMessage, OpenAiToolDefinition } from "./openai.js";
import {
  AiPolicyError,
  SHINA_ONLY_POLICY,
  type AiPolicy,
  type BillingSource,
  type CredentialSource,
} from "./types.js";

// The single funnel every caller that calls an LLM must go through:
//   auth -> workspace context -> AI policy -> provider/credential
//   resolution -> credit check -> provider call -> usage metering -> ledger
// Extracted 2026-09 from apps/mkt/src/lib/ai/gateway.ts (the "AI Gateway"
// of docs/ai/AI_PROVIDER_STRATEGY.md) so a second consumer (the Shinã
// Agent Platform in apps/web) shares the same credit ledger/usage meter
// instead of building a parallel one.
//
// Two distinct call shapes exist, each pinned to its own provider (not a
// generic "pick any provider" abstraction):
//   - prompt/vision (apps/mkt, credentialMode "auto", SHINA/BYOK/HYBRID) —
//     always Anthropic, unchanged since P1.
//   - messages (the Shinã Agent's tool-calling loop, credentialMode
//     "shina_only") — always OpenAI as of 2026-09 (explicit product
//     decision: apps/web only ever configures OPENAI_API_KEY, never
//     ANTHROPIC_API_KEY, so the agent runs on OpenAI exclusively instead
//     of needing a second provider key just for this one surface).
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export class DuplicateRequestError extends Error {
  constructor() {
    super("Esta requisição já foi processada (idempotency key repetida).");
  }
}

interface GatewayInput {
  /** Session-scoped client (RLS-respecting) — used for usage insert + the
   * credit RPC. apps/web passes its single admin client here too (it
   * already bypasses RLS by construction, see apps/web's tenant-context.ts). */
  db: SupabaseClient;
  /** Must be an admin/service-role client — the model cost policy table has
   * zero RLS policies for `authenticated` by design (internal cost is
   * never customer-visible). */
  adminDb: SupabaseClient;
  ctx: { workspaceId: string; tenantId: string; userId: string };
  operation: string;
  capability: "text" | "vision";
  entityType?: string;
  model?: string;
  maxTokens?: number;
  idempotencyKey?: string | null;
  system: string;
  /** Single-turn convenience — mutually exclusive with `messages`. */
  prompt?: string;
  /** Multi-turn / tool-calling loop — OpenAI's native message shape (this
   * path always runs on OpenAI, see the file header comment). Mutually
   * exclusive with `prompt`. */
  messages?: OpenAiMessage[];
  tools?: OpenAiToolDefinition[];
  /** Required when capability === "vision". */
  imageUrl?: string;
  /**
   * "auto" (default) — resolves the workspace/tenant AiPolicy from
   * ai_gateway_policy + BYOK, exactly as apps/mkt behaves today.
   * "shina_only" — skips policy/BYOK resolution entirely and always uses
   * the platform's own Shinã credential. The Shinã Agent Platform
   * (apps/web) always passes this — it is SHINA-exclusive by product
   * decision, there is no code path for a tenant to configure a BYOK key
   * for the agent.
   */
  credentialMode?: "auto" | "shina_only";
  /** Required product key for platform_subscriptions lookups when
   * credentialMode is "auto" (e.g. "mkt"). Ignored for "shina_only". */
  product?: string;
  /** Injected decrypt for BYOK keys — only needed when credentialMode is
   * "auto". Not required (and never called) for "shina_only". */
  decryptByokKey?: (encoded: string) => Promise<string>;
}

interface GatewayResult {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  usageId: string;
  credentialSource: CredentialSource;
  billingSource: BillingSource;
  creditsConsumed: number | null;
  toolUses: { id: string; name: string; input: Record<string, unknown> }[];
  stopReason: string | null;
}

interface CredentialDecision {
  source: CredentialSource;
  billingSource: BillingSource;
}

// Pure decision matrix — no I/O, directly unit-testable without mocking
// Supabase/env. resolveCredential() below is the only caller and supplies
// the already-resolved inputs.
export function decideCredentialSource(
  mode: "SHINA" | "BYOK" | "HYBRID",
  hasByokKey: boolean,
  hasShinaKey: boolean,
  preferredSource: CredentialSource | null,
  allowShinaFallback: boolean,
): CredentialDecision {
  const shina = (): CredentialDecision => {
    if (!hasShinaKey) throw new AiPolicyError("shina_unavailable", 503, "shina_not_configured");
    return { source: "SHINA", billingSource: "SHINA_CREDITS" };
  };
  const byok = (): CredentialDecision => {
    if (!hasByokKey) throw new AiPolicyError("byok_unavailable", 424, "byok_not_configured");
    return { source: "BYOK", billingSource: "EXTERNAL_PROVIDER" };
  };

  if (mode === "SHINA") return shina();
  if (mode === "BYOK") return byok();

  // HYBRID — deterministic, never a silent fallback. Preference defaults
  // to BYOK (never charges Shinã credits unless explicitly unavailable and
  // fallback is explicitly allowed).
  const preferred = preferredSource ?? "BYOK";
  if (preferred === "BYOK") {
    if (hasByokKey) return byok();
    if (allowShinaFallback) return shina();
    throw new AiPolicyError("byok_unavailable_no_fallback", 424, "byok_not_configured");
  }
  // preferred === "SHINA"
  if (hasShinaKey) return shina();
  if (hasByokKey) return byok(); // falling back TO the workspace's own key never causes unexpected Shinã billing
  throw new AiPolicyError("no_credential", 424, "no_credential");
}

async function resolveCredential(
  input: GatewayInput,
): Promise<{ apiKey: string; credentialSource: CredentialSource; billingSource: BillingSource }> {
  let policy: AiPolicy;
  let byokKey: string | undefined;

  if (input.credentialMode === "shina_only") {
    policy = SHINA_ONLY_POLICY;
    byokKey = undefined;
  } else {
    if (!input.product) throw new Error("gateway: product is required when credentialMode is auto");
    policy = await resolveAiPolicy(
      input.db,
      input.ctx.workspaceId,
      input.ctx.tenantId,
      input.product,
    );
    byokKey = input.decryptByokKey
      ? await resolveAnthropicKey(input.db, input.ctx.workspaceId, input.decryptByokKey)
      : undefined;
  }
  // shina_only (the Agent's messages/OpenAI path) checks OPENAI_API_KEY;
  // auto (apps/mkt's prompt/vision/Anthropic path) checks ANTHROPIC_API_KEY —
  // each credentialMode is permanently paired with its own provider, see
  // the file header comment.
  const shinaKey =
    input.credentialMode === "shina_only"
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;

  let decision: CredentialDecision;
  try {
    decision = decideCredentialSource(
      policy.mode,
      Boolean(byokKey),
      Boolean(shinaKey),
      policy.preferredSource,
      policy.allowShinaFallback,
    );
  } catch (e) {
    if (e instanceof AiPolicyError) {
      const messages: Record<string, string> = {
        shina_not_configured:
          "IA Shinã não está configurada no servidor no momento. Tente novamente mais tarde.",
        byok_not_configured:
          "Nenhuma credencial de IA conectada para este workspace. Conecte sua chave em Configurações → IA e Modelos, ou mude para IA Shinã.",
        no_credential: "Nenhuma credencial de IA disponível para este workspace.",
      };
      throw new AiPolicyError(messages[e.code] ?? e.message, e.status, e.code);
    }
    throw e;
  }

  const apiKey = decision.source === "SHINA" ? shinaKey : byokKey;
  if (!apiKey)
    throw new AiPolicyError(
      "Nenhuma credencial de IA disponível para este workspace.",
      424,
      "no_credential",
    );
  return { apiKey, credentialSource: decision.source, billingSource: decision.billingSource };
}

export async function runAiGateway(input: GatewayInput): Promise<GatewayResult> {
  if (!input.prompt && !input.messages) {
    throw new Error("gateway: either prompt or messages is required");
  }

  if (input.idempotencyKey) {
    const { data: existing } = await input.db
      .from("ai_gateway_usage")
      .select("id")
      .eq("workspace_id", input.ctx.workspaceId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) throw new DuplicateRequestError();
  }

  const { apiKey, credentialSource, billingSource } = await resolveCredential(input);
  // The messages path always runs on OpenAI (the Shinã Agent), everything
  // else (prompt/vision, apps/mkt) always runs on Anthropic — see the file
  // header comment for why this isn't a generic provider selector.
  const provider = input.messages ? "openai" : "anthropic";
  const model =
    input.model ?? (provider === "openai" ? OPENAI_DEFAULT_MODEL : ANTHROPIC_DEFAULT_MODEL);
  const maxTokens = input.maxTokens ?? 2048;

  let estimatedCredits: number | null = null;
  if (billingSource === "SHINA_CREDITS") {
    estimatedCredits = await estimateMaxCredits(input.adminDb, {
      provider,
      model,
      capability: input.capability,
      maxTokens,
    });
    if (estimatedCredits !== null) {
      const balance = await getCreditBalance(input.db, input.ctx.workspaceId);
      if (balance < estimatedCredits) {
        throw new InsufficientCreditsError(estimatedCredits, balance);
      }
    }
  }

  const started = Date.now();
  let text: string;
  let tokensIn: number;
  let tokensOut: number;
  let responseModel: string;
  let toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];
  let stopReason: string | null = null;

  if (input.capability === "vision") {
    if (!input.imageUrl)
      throw new AIProviderError("imageUrl is required for vision capability", 500);
    if (!input.prompt) throw new AIProviderError("prompt is required for vision capability", 500);
    const result = await analyzeImage({
      system: input.system,
      prompt: input.prompt,
      imageUrl: input.imageUrl,
      maxTokens,
      model,
      apiKey,
    });
    text = result.text;
    tokensIn = result.tokensIn;
    tokensOut = result.tokensOut;
    responseModel = result.model;
  } else if (input.messages) {
    // Multi-turn / tool-calling path — used by the Shinã Agent's tool loop.
    // Bypasses @shina/ai-platform's ModelProvider abstraction on purpose
    // (its ModelMessage can't losslessly represent tool_use/tool_result
    // shapes) and talks to OpenAI's native message/tool-call format
    // directly (this path always runs on OpenAI, see the file header
    // comment) — same posture as the existing maintenance-copilot route's
    // own direct-to-provider tool loop.
    const result = await generateWithMessagesOpenAI({
      system: input.system,
      messages: input.messages,
      maxTokens,
      model,
      apiKey,
      tools: input.tools,
    });
    text = result.text;
    tokensIn = result.tokensIn;
    tokensOut = result.tokensOut;
    responseModel = result.model;
    toolUses = result.toolCalls.map((t) => ({ id: t.id, name: t.name, input: t.arguments }));
    stopReason = result.stopReason;
  } else {
    const response = await getModelProviderRegistry()
      .get("anthropic")
      .complete({
        model,
        maxTokens,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt as string },
        ],
        credentials: { apiKey },
      });
    text = response.content;
    tokensIn = response.usage.promptTokens;
    tokensOut = response.usage.completionTokens;
    responseModel = response.model;
    toolUses = (response.toolCalls ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      input: t.arguments,
    }));
    stopReason = response.finishReason;
  }
  const durationMs = Date.now() - started;

  let creditsConsumed: number | null = null;
  let estimatedCostUsd: number | null = null;
  if (billingSource === "SHINA_CREDITS") {
    const actual = await estimateCredits(input.adminDb, {
      provider,
      model: responseModel,
      capability: input.capability,
      tokensIn,
      tokensOut,
    });
    estimatedCostUsd = actual?.costUsd ?? null;
    creditsConsumed = actual?.credits ?? null;
  }

  const { data: usageRow, error: usageError } = await input.db
    .from("ai_gateway_usage")
    .insert({
      workspace_id: input.ctx.workspaceId,
      tenant_id: input.ctx.tenantId,
      user_id: input.ctx.userId,
      provider,
      model: responseModel,
      operation: input.operation,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      duration_ms: durationMs,
      entity_type: input.entityType ?? null,
      credential_source: credentialSource,
      billing_source: billingSource,
      credits_consumed: creditsConsumed,
      estimated_cost_usd: estimatedCostUsd,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select("id")
    .single();
  if (usageError || !usageRow) throw usageError ?? new Error("failed to record ai usage");

  // Deduct AFTER the call (exact cost only known post-hoc) — the pre-check
  // above is what satisfies "don't call the provider first, discover no
  // credit after"; this is metering the real cost, not the gate.
  if (billingSource === "SHINA_CREDITS" && creditsConsumed !== null) {
    try {
      await consumeCredits(input.db, {
        workspaceId: input.ctx.workspaceId,
        tenantId: input.ctx.tenantId,
        credits: creditsConsumed,
        usageId: usageRow.id as string,
        metadata: { operation: input.operation, model: responseModel },
      });
    } catch (err) {
      // Provider was already called and the caller already has their
      // result — surfacing this as a hard failure would throw away real
      // output over a metering race. Known limitation: not a silent
      // no-op, it's logged.
      console.error("[ai-gateway] credit deduction failed post-call", err);
    }
  }

  return {
    text,
    model: responseModel,
    tokensIn,
    tokensOut,
    usageId: usageRow.id as string,
    credentialSource,
    billingSource,
    creditsConsumed,
    toolUses,
    stopReason,
  };
}
