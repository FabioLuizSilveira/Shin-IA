// AI Gateway — canonical types. Every "SHINA"/"BYOK"/"HYBRID" string in any
// consuming app must come from this module, never be re-typed ad hoc.
//
// Extracted 2026-09 from apps/mkt/src/lib/ai/* (the first real, working AI
// Gateway in this monorepo — SHINA/BYOK/HYBRID credential resolution,
// versioned cost/pricing policy, an append-only credit ledger with an
// atomic Postgres RPC) into this shared package so a second consumer
// (the Shinã Agent Platform in apps/web) doesn't reimplement it. apps/mkt
// itself is migrated to import from here rather than keeping its own copy.

export type AiMode = "SHINA" | "BYOK" | "HYBRID";

export type CredentialSource = "SHINA" | "BYOK";
export type BillingSource = "SHINA_CREDITS" | "EXTERNAL_PROVIDER";

export interface AiPolicy {
  mode: AiMode;
  shinaAiEnabled: boolean;
  byokEnabled: boolean;
  allowedProviders: string[];
  allowedModels: string[] | null;
  /** Only meaningful when mode === "HYBRID". */
  preferredSource: CredentialSource | null;
  allowShinaFallback: boolean;
  creditBalance: number | null;
}

// The Shinã Agent Platform (apps/web) is SHINA-exclusive by product
// decision — it never resolves a workspace/tenant AI policy row and never
// touches BYOK at all (see gateway.ts's `credentialMode: "shina_only"`
// path). This constant is what it always uses instead of resolveAiPolicy().
export const SHINA_ONLY_POLICY: AiPolicy = {
  mode: "SHINA",
  shinaAiEnabled: true,
  byokEnabled: false,
  allowedProviders: ["anthropic"],
  allowedModels: null,
  preferredSource: null,
  allowShinaFallback: false,
  creditBalance: null,
};

export type CreditEventType =
  | "CREDIT_GRANT"
  | "AI_USAGE"
  | "CREDIT_PURCHASE"
  | "PLAN_RENEWAL"
  | "ADJUSTMENT"
  | "REFUND"
  | "EXPIRATION";

export class AiPolicyError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
