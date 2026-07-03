import type { MktAIOperation, MktAIProviderConfig, MktAIProviderName } from "../types.js";

// Selects which configured provider should handle each AI operation.
// Preference order is configuration, not code: workspaces can override via
// their provider configs (is_default wins); this table is only the fallback.

const OPERATION_PREFERENCES: Record<MktAIOperation, MktAIProviderName[]> = {
  generate_ad: ["openai", "anthropic", "gemini"],
  clone_ad: ["anthropic", "openai", "gemini"],
  copy: ["anthropic", "openai", "deepseek", "groq"],
  strategy: ["anthropic", "openai", "gemini"],
  vision: ["anthropic", "openai", "gemini"],
  embed: ["openai", "gemini", "ollama"],
};

export function selectProvider(
  operation: MktAIOperation,
  configured: MktAIProviderConfig[],
): MktAIProviderConfig | undefined {
  const active = configured.filter((c) => c.isActive);
  if (active.length === 0) return undefined;

  const explicit = active.find((c) => c.isDefault);
  if (explicit) return explicit;

  for (const preferred of OPERATION_PREFERENCES[operation]) {
    const match = active.find((c) => c.provider === preferred);
    if (match) return match;
  }

  return active[0];
}
