export type { ShinaIdentity, ShinaSession } from "./types.js";
export type { IdentityProvider } from "./provider.js";
export { SupabaseIdentityProvider } from "./supabase-provider.js";
export { FirebaseIdentityProvider } from "./firebase-provider.js";
export { FakeIdentityProvider } from "./fake-provider.js";
export { resolveCanonicalIdentity } from "./canonical-identity.js";
export {
  resolveActiveIdentityProviderKind,
  type IdentityProviderKind,
} from "./provider-resolver.js";
