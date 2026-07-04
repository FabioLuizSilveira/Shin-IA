import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";

/**
 * Resolves the Anthropic API key for a workspace.
 * A BYOK key (stored encrypted per workspace) wins over the platform env key.
 * Returns undefined when the workspace has no key — callers fall back to env.
 */
export async function resolveAnthropicKey(workspaceId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mkt_ai_providers")
    .select("api_key_enc, is_active")
    .eq("workspace_id", workspaceId)
    .eq("provider", "anthropic")
    .maybeSingle();

  if (!data?.api_key_enc || !data.is_active) return undefined;
  try {
    return await decryptSecret(data.api_key_enc);
  } catch {
    return undefined;
  }
}
