import type { Auth as FirebaseAdminAuth } from "firebase-admin/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentityProvider } from "./provider.js";
import type { ShinaSession } from "./types.js";
import { resolveCanonicalIdentity } from "./canonical-identity.js";

// Firebase Foundation (migration Phase 1) — implements the same
// IdentityProvider contract SupabaseIdentityProvider does, so call sites
// depend on the contract either way. Not wired into any app's active
// provider yet (see Phase 2/3 of docs/architecture/FIREBASE_AUTH_MIGRATION.md)
// — this class exists and is tested, but IDENTITY_PROVIDER stays "supabase"
// until a real Firebase project's credentials are configured and homologation
// passes.
//
// Both Firebase Admin and Supabase clients are needed: Firebase only
// answers "who is this," but tenant/role/subscription context still lives
// in Supabase Postgres (external_identities + resolve_shina_authorization_context,
// see the migration above) — same "Firebase resolves identity, Shinã
// resolves authorization" split the migration spec requires.
export class FirebaseIdentityProvider implements IdentityProvider {
  constructor(
    private readonly getFirebaseAuth: () => FirebaseAdminAuth,
    private readonly getSupabaseAdmin: () => SupabaseClient,
    // Injected rather than read from cookies() directly, same reasoning as
    // SupabaseIdentityProvider: this package can't depend on next/headers.
    // Firebase's server-side session concept is a "session cookie" (a JWT
    // Firebase itself issues via createSessionCookie(idToken)), verified
    // with verifySessionCookie — distinct from the short-lived ID token
    // sent as a bearer token by native/mobile clients.
    private readonly getSessionCookieValue: () => Promise<string | null> | string | null,
  ) {}

  async getSessionFromCookies(): Promise<ShinaSession | null> {
    const cookie = await this.getSessionCookieValue();
    if (!cookie) return null;

    const decoded = await this.verify((auth) => auth.verifySessionCookie(cookie, true));
    if (!decoded) return null;

    return this.buildSession(decoded.uid, decoded.email ?? null, cookie);
  }

  async getSessionFromBearerToken(bearerToken: string): Promise<ShinaSession | null> {
    const decoded = await this.verify((auth) => auth.verifyIdToken(bearerToken));
    if (!decoded) return null;

    return this.buildSession(decoded.uid, decoded.email ?? null, bearerToken);
  }

  async signOut(): Promise<void> {
    // Firebase sign-out is a client-side SDK call (auth.signOut()) that
    // clears local session state — there is no server-side equivalent
    // called by any current route. Revoking refresh tokens server-side
    // (getFirebaseAuth().revokeRefreshTokens(uid)) is available to callers
    // that need forced logout-everywhere, but isn't wired here since no
    // call site needs it today (mirrors SupabaseIdentityProvider.signOut(),
    // which is likewise unused by any route so far).
  }

  private async verify<T>(fn: (auth: FirebaseAdminAuth) => Promise<T>): Promise<T | null> {
    try {
      return await fn(this.getFirebaseAuth());
    } catch {
      // Covers expired/revoked/malformed/wrong-project tokens alike —
      // verifyIdToken/verifySessionCookie throw for all of them; callers
      // only need to know "not a valid session," not the specific reason.
      return null;
    }
  }

  private async buildSession(
    firebaseUid: string,
    email: string | null,
    accessToken: string,
  ): Promise<ShinaSession> {
    const identity = await resolveCanonicalIdentity(
      this.getSupabaseAdmin(),
      "firebase",
      firebaseUid,
      email,
    );
    return { accessToken, identity };
  }
}
