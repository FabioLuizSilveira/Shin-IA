import {
  SupabaseIdentityProvider,
  FirebaseIdentityProvider,
  resolveActiveIdentityProviderKind,
  type IdentityProvider,
} from "@shina/identity";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import { FIREBASE_SESSION_COOKIE } from "@/lib/firebase-session-cookie";

// The one place apps/web decides which IdentityProvider is active and
// constructs it — every call site depends on the IdentityProvider contract,
// never on this file's internals. IDENTITY_PROVIDER is unset in every
// environment today, so resolveActiveIdentityProviderKind() always returns
// "supabase" here: this file exists ahead of the Firebase cutover
// (docs/architecture/FIREBASE_AUTH_MIGRATION.md) so that flipping the
// active provider later is a one-line env change, not a code change.
// getFirebaseAdminAuth() itself only touches FIREBASE_ADMIN_* env vars when
// actually called, so importing it costs nothing on the (current, default)
// Supabase path.
function buildIdentityProvider(): IdentityProvider {
  const kind = resolveActiveIdentityProviderKind(process.env);

  if (kind === "firebase") {
    return new FirebaseIdentityProvider(getFirebaseAdminAuth, createAdminClient, async () => {
      const cookieStore = await cookies();
      return cookieStore.get(FIREBASE_SESSION_COOKIE)?.value ?? null;
    });
  }

  return new SupabaseIdentityProvider(createClient, createAdminClient);
}

export const identityProvider: IdentityProvider = buildIdentityProvider();
