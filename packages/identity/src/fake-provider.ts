import type { IdentityProvider } from "./provider.js";
import type { ShinaIdentity, ShinaSession } from "./types.js";

// Test-only. Never imported by production route code — its purpose is to
// let call sites that depend on IdentityProvider be unit-tested without a
// live Supabase project, proving the contract is actually swappable rather
// than SupabaseIdentityProvider being the only thing that could ever
// satisfy it.
export class FakeIdentityProvider implements IdentityProvider {
  signOutCalled = false;

  constructor(
    private readonly cookieSession: ShinaSession | null = null,
    private readonly bearerSessions: Record<string, ShinaSession> = {},
  ) {}

  static withIdentity(identity: Partial<ShinaIdentity> & { uid: string }): FakeIdentityProvider {
    const full: ShinaIdentity = {
      email: null,
      tenantId: null,
      tenantRole: null,
      platformRole: null,
      mfaEnrolled: false,
      platformSubscriptionStatus: null,
      mktSubscriptionStatus: null,
      platformContractCurrent: false,
      ...identity,
    };
    return new FakeIdentityProvider({ identity: full, accessToken: "fake-token" });
  }

  async getSessionFromCookies(): Promise<ShinaSession | null> {
    return this.cookieSession;
  }

  async getSessionFromBearerToken(bearerToken: string): Promise<ShinaSession | null> {
    return this.bearerSessions[bearerToken] ?? null;
  }

  async signOut(): Promise<void> {
    this.signOutCalled = true;
  }
}
