import type { ShinaSession } from "./types.js";

// The full surface every real call site in the codebase actually needs
// today, audited across apps/web + apps/mkt + apps/mobile: resolve the
// caller's identity from one of the two transports already in use
// (browser cookie session, or a bearer token for cookie-less clients like
// the mobile app), and end that identity's session. Nothing else is
// abstracted — MFA enrollment, OAuth sign-in, magic links, password reset
// stay direct Supabase calls at their existing call sites (login/signup
// pages, MFA routes), since those are one-shot flows tied to Supabase's
// own UI-facing APIs, not something a future provider swap would touch
// without a parallel UI rewrite anyway.
export interface IdentityProvider {
  // Mirrors createClient(await cookies()) + supabase.auth.getSession(),
  // the path every browser-facing route uses.
  getSessionFromCookies(): Promise<ShinaSession | null>;

  // Mirrors createAdminClient().auth.getUser(bearerToken), the path
  // cookie-less clients (mobile) use.
  getSessionFromBearerToken(bearerToken: string): Promise<ShinaSession | null>;

  signOut(): Promise<void>;
}
