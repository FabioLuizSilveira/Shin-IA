import { createClient } from "@/lib/supabase/server";
import type { AiMode, AiPolicy, CredentialSource } from "./types";

const DEFAULT_ALLOWED_PROVIDERS = [
  "anthropic",
  "openai",
  "gemini",
  "deepseek",
  "mistral",
  "groq",
  "openrouter",
  "ollama",
];

interface PlanAiLimits {
  monthlyAiCredits?: number | null;
  byokAllowed?: boolean;
  hybridAllowed?: boolean;
  allowedProviders?: string[];
  allowedModels?: string[];
}

// Reads the mkt plan's usage_limits jsonb (@shina/commercial-platform's
// plan_versions table — no per-provider contract, this is the same
// extension point plans already use for other limits). Plan defaults are
// deliberately conservative: byokAllowed=true, everything else off, until
// a human sets real numbers on a plan_version (item 26 — no commercial
// numbers are decided by this code).
async function resolvePlanAiLimits(tenantId: string): Promise<PlanAiLimits> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_subscriptions")
    .select("status, plan_versions(usage_limits)")
    .eq("tenant_id", tenantId)
    .eq("product", "mkt")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const active = data?.status === "active" || data?.status === "trialing";
  if (!active) return { byokAllowed: true };

  const planVersions = data?.plan_versions as unknown as { usage_limits: PlanAiLimits } | null;
  const limits = planVersions?.usage_limits ?? {};
  return { byokAllowed: true, ...limits };
}

// Pure — unit-tested directly (see policy.test.ts). A plan can revoke
// BYOK/hybrid even if the workspace previously set itself to that mode —
// the plan is the ceiling, the workspace override is the choice within
// that ceiling, never above it.
export function capModeToPlan(mode: AiMode, byokAllowed: boolean, hybridAllowed: boolean): AiMode {
  if (mode === "BYOK" && !byokAllowed) return "SHINA";
  if (mode === "HYBRID" && !hybridAllowed) return byokAllowed ? "BYOK" : "SHINA";
  return mode;
}

/**
 * Resolves the effective AI policy for a workspace: the per-workspace
 * override in mkt_ai_policy (if the workspace explicitly set one) layered
 * on top of the plan's defaults. Absence of a workspace row is NOT treated
 * as "Shinã AI is allowed" — the safe default is BYOK-only, matching how
 * every existing workspace already behaves today (item 27).
 */
export async function resolveAiPolicy(workspaceId: string, tenantId: string): Promise<AiPolicy> {
  const supabase = await createClient();

  const [{ data: override }, { data: balanceRow }, planLimits] = await Promise.all([
    supabase
      .from("mkt_ai_policy")
      .select("mode, preferred_source, allow_shina_fallback")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("mkt_ai_credit_balances")
      .select("balance")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    resolvePlanAiLimits(tenantId),
  ]);

  const mode: AiMode = (override?.mode as AiMode | undefined) ?? "BYOK";
  const byokAllowed = planLimits.byokAllowed ?? true;
  const hybridAllowed = planLimits.hybridAllowed ?? true;
  const effectiveMode = capModeToPlan(mode, byokAllowed, hybridAllowed);

  return {
    mode: effectiveMode,
    shinaAiEnabled: effectiveMode === "SHINA" || effectiveMode === "HYBRID",
    byokEnabled: effectiveMode === "BYOK" || effectiveMode === "HYBRID",
    allowedProviders: planLimits.allowedProviders ?? DEFAULT_ALLOWED_PROVIDERS,
    allowedModels: planLimits.allowedModels ?? null,
    preferredSource: (override?.preferred_source as CredentialSource | null) ?? null,
    allowShinaFallback: override?.allow_shina_fallback ?? false,
    creditBalance: balanceRow?.balance ?? null,
  };
}

export async function upsertAiPolicy(
  workspaceId: string,
  tenantId: string,
  userId: string,
  input: { mode: AiMode; preferredSource?: CredentialSource | null; allowShinaFallback?: boolean },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("mkt_ai_policy").upsert(
    {
      workspace_id: workspaceId,
      tenant_id: tenantId,
      mode: input.mode,
      preferred_source: input.preferredSource ?? null,
      allow_shina_fallback: input.allowShinaFallback ?? false,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" },
  );
  if (error) throw error;
}
