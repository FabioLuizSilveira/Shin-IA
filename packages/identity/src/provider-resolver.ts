// Centralizes which provider is active, per migration spec item 13: the
// app must not spread `if firebase... if supabase...` across route code.
// A single env var controls it; every call site keeps depending on
// IdentityProvider, never on this type directly.
export type IdentityProviderKind = "supabase" | "firebase";

export function resolveActiveIdentityProviderKind(
  env: Record<string, string | undefined>,
): IdentityProviderKind {
  const value = env.IDENTITY_PROVIDER;
  if (value === "firebase") return "firebase";
  // Default stays "supabase" — the current, only-active provider until a
  // real Firebase project is configured and Phase 2/3 homologation passes.
  return "supabase";
}
