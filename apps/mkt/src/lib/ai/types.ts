// AI Gateway — canonical types. Every "SHINA"/"BYOK"/"HYBRID" string in the
// app must come from this module, never be re-typed ad hoc (see
// docs/ai/AI_PROVIDER_STRATEGY.md).

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

export class AiPolicyError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
