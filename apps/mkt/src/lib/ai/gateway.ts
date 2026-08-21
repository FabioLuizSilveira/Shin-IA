import { createClient } from "@/lib/supabase/server";
import { resolveAnthropicKey } from "./byok";
import { resolveAiPolicy } from "./policy";
import { estimateCredits, estimateMaxCredits } from "./cost-policy";
import { consumeCredits, getCreditBalance, InsufficientCreditsError } from "./credits";
import { getModelProviderRegistry } from "./registry";
import { analyzeImage, AIProviderError } from "./anthropic";
import { AiPolicyError, type BillingSource, type CredentialSource } from "./types";

// The single funnel every mkt feature that calls an LLM must go through:
//   auth -> workspace context -> AI policy -> provider/credential
//   resolution -> credit check -> provider call -> usage metering -> ledger
// No feature route calls generateText()/analyzeImage() with a resolved key
// directly anymore (see /api/generate, /api/clone, /api/strategy) — this is
// the "AI Gateway" of docs/ai/AI_PROVIDER_STRATEGY.md.
const DEFAULT_MODEL = "claude-sonnet-5";
const PROVIDER = "anthropic"; // only provider with a real BYOK+Shinã path today

export class DuplicateRequestError extends Error {
  constructor() {
    super("Esta requisição já foi processada (idempotency key repetida).");
  }
}

interface GatewayInput {
  ctx: { workspaceId: string; tenantId: string; userId: string };
  operation: string;
  capability: "text" | "vision";
  entityType?: string;
  model?: string;
  maxTokens?: number;
  idempotencyKey?: string | null;
  system: string;
  prompt: string;
  /** Required when capability === "vision". */
  imageUrl?: string;
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
}

interface CredentialDecision {
  source: CredentialSource;
  billingSource: BillingSource;
}

// Pure decision matrix — no I/O, so it's directly unit-testable (see
// gateway.test.ts) without mocking Supabase/env. resolveCredential() below
// is the only caller and supplies the already-resolved inputs.
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

  // HYBRID — deterministic, never a silent fallback (item 8). Preference
  // defaults to BYOK (never charges Shinã credits unless explicitly
  // unavailable and fallback is explicitly allowed).
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
  ctx: GatewayInput["ctx"],
): Promise<{ apiKey: string; credentialSource: CredentialSource; billingSource: BillingSource }> {
  const policy = await resolveAiPolicy(ctx.workspaceId, ctx.tenantId);
  const byokKey = await resolveAnthropicKey(ctx.workspaceId);
  const shinaKey = process.env.ANTHROPIC_API_KEY;

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
      // Re-throw with the real user-facing message (the pure function only
      // carries a stable machine code, so tests don't couple to copy).
      const messages: Record<string, string> = {
        shina_not_configured:
          "IA Shinã não está configurada no servidor no momento. Tente novamente mais tarde ou conecte sua própria chave em Configurações → IA e Modelos.",
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
  const supabase = await createClient();

  if (input.idempotencyKey) {
    const { data: existing } = await supabase
      .from("mkt_ai_usage")
      .select("id")
      .eq("workspace_id", input.ctx.workspaceId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) throw new DuplicateRequestError();
  }

  const { apiKey, credentialSource, billingSource } = await resolveCredential(input.ctx);
  const model = input.model ?? DEFAULT_MODEL;
  const maxTokens = input.maxTokens ?? 2048;

  let estimatedCredits: number | null = null;
  if (billingSource === "SHINA_CREDITS") {
    estimatedCredits = await estimateMaxCredits({
      provider: PROVIDER,
      model,
      capability: input.capability,
      maxTokens,
    });
    if (estimatedCredits !== null) {
      const balance = await getCreditBalance(input.ctx.workspaceId);
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

  if (input.capability === "vision") {
    if (!input.imageUrl)
      throw new AIProviderError("imageUrl is required for vision capability", 500);
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
  } else {
    const response = await getModelProviderRegistry()
      .get("anthropic")
      .complete({
        model,
        maxTokens,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
        credentials: { apiKey },
      });
    text = response.content;
    tokensIn = response.usage.promptTokens;
    tokensOut = response.usage.completionTokens;
    responseModel = response.model;
  }
  const durationMs = Date.now() - started;

  let creditsConsumed: number | null = null;
  let estimatedCostUsd: number | null = null;
  if (billingSource === "SHINA_CREDITS") {
    const actual = await estimateCredits({
      provider: PROVIDER,
      model: responseModel,
      capability: input.capability,
      tokensIn,
      tokensOut,
    });
    estimatedCostUsd = actual?.costUsd ?? null;
    creditsConsumed = actual?.credits ?? null;
  }

  const { data: usageRow, error: usageError } = await supabase
    .from("mkt_ai_usage")
    .insert({
      workspace_id: input.ctx.workspaceId,
      tenant_id: input.ctx.tenantId,
      user_id: input.ctx.userId,
      provider: PROVIDER,
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
  // credit after" (item 6); this is metering the real cost, not the gate.
  if (billingSource === "SHINA_CREDITS" && creditsConsumed !== null) {
    try {
      await consumeCredits({
        workspaceId: input.ctx.workspaceId,
        tenantId: input.ctx.tenantId,
        credits: creditsConsumed,
        usageId: usageRow.id as string,
        metadata: { operation: input.operation, model: responseModel },
      });
    } catch (err) {
      // Provider was already called and the caller already has their
      // result — surfacing this as a hard failure would throw away real
      // output over a metering race. Known limitation, documented in
      // docs/ai/AI_PROVIDER_STRATEGY.md: not a silent no-op, it's logged.
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
  };
}
