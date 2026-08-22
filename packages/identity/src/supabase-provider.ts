import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentityProvider } from "./provider.js";
import type { ShinaSession } from "./types.js";
import { identityFromAccessToken } from "./claims.js";

// The only IdentityProvider implementation that exists today, and the only
// one any app actually needs — this class exists so call sites depend on
// the IdentityProvider contract instead of on @supabase/supabase-js
// directly, not because a second provider is imminent. Both client
// factories are injected because cookie-bound clients (Next.js
// `createServerClient` reading `await cookies()`) can't be constructed
// inside a framework-agnostic package — the app still owns cookie/header
// access, this class only owns the auth calls made against the client it's
// given.
export class SupabaseIdentityProvider implements IdentityProvider {
  constructor(
    private readonly getSessionClient: () => Promise<SupabaseClient> | SupabaseClient,
    private readonly getAdminClient: () => SupabaseClient,
  ) {}

  async getSessionFromCookies(): Promise<ShinaSession | null> {
    const client = await this.getSessionClient();
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) return null;

    return {
      accessToken: session.access_token,
      identity: identityFromAccessToken(
        session.access_token,
        session.user.id,
        session.user.email ?? null,
      ),
    };
  }

  async getSessionFromBearerToken(bearerToken: string): Promise<ShinaSession | null> {
    const admin = this.getAdminClient();
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(bearerToken);
    if (error || !user) return null;

    return {
      accessToken: bearerToken,
      identity: identityFromAccessToken(bearerToken, user.id, user.email ?? null),
    };
  }

  async signOut(): Promise<void> {
    const client = await this.getSessionClient();
    await client.auth.signOut();
  }
}
