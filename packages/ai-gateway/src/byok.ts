import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the Anthropic API key for a workspace.
 * A BYOK key (stored encrypted per workspace, in `mkt_ai_providers` — this
 * table stays mkt-specific, it isn't part of the shared credit-ledger
 * schema and apps/web never calls this function) wins over the platform
 * env key. Returns undefined when the workspace has no key — callers fall
 * back to env.
 *
 * `decrypt` is injected rather than imported from an app-local crypto
 * module (this package has no opinion on the encryption implementation) —
 * apps/mkt passes its own `decryptSecret` from `@/lib/crypto`. The Shinã
 * Agent Platform (apps/web) never calls this at all — it is SHINA-only by
 * construction (see gateway.ts's `credentialMode: "shina_only"`).
 */
export async function resolveAnthropicKey(
  db: SupabaseClient,
  workspaceId: string,
  decrypt: (encoded: string) => Promise<string>,
): Promise<string | undefined> {
  const { data } = await db
    .from("mkt_ai_providers")
    .select("api_key_enc, is_active")
    .eq("workspace_id", workspaceId)
    .eq("provider", "anthropic")
    .maybeSingle();

  if (!data?.api_key_enc || !data.is_active) return undefined;
  try {
    return await decrypt(data.api_key_enc as string);
  } catch {
    return undefined;
  }
}
