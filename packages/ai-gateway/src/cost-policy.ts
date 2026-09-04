import type { SupabaseClient } from "@supabase/supabase-js";

// ai_gateway_model_cost_policy has zero RLS policies for `authenticated` —
// callers MUST pass an admin (service-role) client here. Never surface this
// module's result back to a customer-facing response (internal cost is
// never shown to the customer, only the commercial credit price is).
interface CostBasis {
  inputPerMTokUsd?: number;
  outputPerMTokUsd?: number;
}

interface CostPolicyRow {
  cost_basis: CostBasis;
  credit_multiplier: number;
}

async function loadCostPolicy(
  db: SupabaseClient,
  provider: string,
  model: string,
  capability: string,
) {
  const { data } = await db
    .from("ai_gateway_model_cost_policy")
    .select("cost_basis, credit_multiplier")
    .eq("provider", provider)
    .eq("model", model)
    .eq("capability", capability)
    .eq("status", "published")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle<CostPolicyRow>();
  return data;
}

// Pure — unit-tested directly without touching Supabase. estimateCredits()
// below is the only caller and supplies the already-loaded policy row.
export function computeCredits(
  tokensIn: number,
  tokensOut: number,
  costBasis: CostBasis,
  creditMultiplier: number,
): { costUsd: number; credits: number } {
  const inRate = costBasis.inputPerMTokUsd ?? 0;
  const outRate = costBasis.outputPerMTokUsd ?? 0;
  const costUsd = (tokensIn / 1_000_000) * inRate + (tokensOut / 1_000_000) * outRate;
  return { costUsd, credits: costUsd * creditMultiplier };
}

/** Converts a token count into estimated USD cost, then into Shinã AI credits. */
export async function estimateCredits(
  db: SupabaseClient,
  input: {
    provider: string;
    model: string;
    capability: string;
    tokensIn: number;
    tokensOut: number;
  },
): Promise<{ costUsd: number; credits: number } | null> {
  const policy = await loadCostPolicy(db, input.provider, input.model, input.capability);
  if (!policy) return null;
  return computeCredits(
    input.tokensIn,
    input.tokensOut,
    policy.cost_basis,
    policy.credit_multiplier,
  );
}

/** Conservative pre-call estimate from maxTokens alone (no real usage yet). */
export async function estimateMaxCredits(
  db: SupabaseClient,
  input: {
    provider: string;
    model: string;
    capability: string;
    maxTokens: number;
    assumedInputTokens?: number;
  },
): Promise<number | null> {
  const estimate = await estimateCredits(db, {
    provider: input.provider,
    model: input.model,
    capability: input.capability,
    tokensIn: input.assumedInputTokens ?? 2000,
    tokensOut: input.maxTokens,
  });
  return estimate?.credits ?? null;
}
