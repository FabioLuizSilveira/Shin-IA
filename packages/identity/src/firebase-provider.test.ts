import { describe, expect, it, vi } from "vitest";
import { FirebaseIdentityProvider } from "./firebase-provider.js";
import { resolveActiveIdentityProviderKind } from "./provider-resolver.js";

function makeSupabaseAdmin(opts: {
  link: { shina_user_id: string } | null;
  ctx?: Record<string, unknown>;
  ctxError?: { message: string };
}) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: opts.link }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({}),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: opts.ctx ?? {}, error: opts.ctxError ?? null }),
  };
}

describe("FirebaseIdentityProvider", () => {
  it("returns null for an invalid/expired/revoked bearer token", async () => {
    const auth = { verifyIdToken: vi.fn().mockRejectedValue(new Error("invalid")) };
    const provider = new FirebaseIdentityProvider(
      () => auth as any,
      () => makeSupabaseAdmin({ link: null }) as any,
      () => null,
    );
    expect(await provider.getSessionFromBearerToken("bad-token")).toBeNull();
  });

  it("returns an unprovisioned identity for a valid but unlinked Firebase UID", async () => {
    const auth = {
      verifyIdToken: vi.fn().mockResolvedValue({ uid: "fb-unknown", email: "x@e.com" }),
    };
    const db = makeSupabaseAdmin({ link: null });
    const provider = new FirebaseIdentityProvider(
      () => auth as any,
      () => db as any,
      () => null,
    );
    const session = await provider.getSessionFromBearerToken("valid-token");
    expect(session?.identity).toEqual({
      uid: "fb-unknown",
      email: "x@e.com",
      tenantId: null,
      tenantRole: null,
      platformRole: null,
      mfaEnrolled: false,
      platformSubscriptionStatus: null,
      mktSubscriptionStatus: null,
      platformContractCurrent: false,
    });
    // Never auto-provisions a tenant for an unknown identity.
    expect(session?.identity.tenantId).toBeNull();
  });

  it("resolves a linked Firebase UID to its canonical shina_user_id and authorization context", async () => {
    const auth = {
      verifyIdToken: vi.fn().mockResolvedValue({ uid: "fb-known", email: "owner@e.com" }),
    };
    const db = makeSupabaseAdmin({
      link: { shina_user_id: "legacy-uuid-1" },
      ctx: { tenant_id: "t1", tenant_role: "tenant_owner", platform_role: "platform_owner" },
    });
    const provider = new FirebaseIdentityProvider(
      () => auth as any,
      () => db as any,
      () => null,
    );
    const session = await provider.getSessionFromBearerToken("valid-token");
    expect(session?.identity.uid).toBe("legacy-uuid-1");
    expect(session?.identity.tenantId).toBe("t1");
    expect(session?.identity.platformRole).toBe("platform_owner");
  });

  it("verifies a session cookie for the cookie-based path, distinct from bearer verifyIdToken", async () => {
    const verifySessionCookie = vi.fn().mockResolvedValue({ uid: "fb-cookie", email: null });
    const auth = { verifySessionCookie };
    const db = makeSupabaseAdmin({ link: null });
    const provider = new FirebaseIdentityProvider(
      () => auth as any,
      () => db as any,
      () => "session-cookie-value",
    );
    const session = await provider.getSessionFromCookies();
    expect(verifySessionCookie).toHaveBeenCalledWith("session-cookie-value", true);
    expect(session?.identity.uid).toBe("fb-cookie");
  });

  it("returns null from getSessionFromCookies when there is no cookie at all", async () => {
    const provider = new FirebaseIdentityProvider(
      () => ({ verifySessionCookie: vi.fn() }) as any,
      () => makeSupabaseAdmin({ link: null }) as any,
      () => null,
    );
    expect(await provider.getSessionFromCookies()).toBeNull();
  });

  it("propagates a real RPC error instead of silently returning an empty identity", async () => {
    const auth = { verifyIdToken: vi.fn().mockResolvedValue({ uid: "fb-known", email: null }) };
    const db = makeSupabaseAdmin({
      link: { shina_user_id: "legacy-uuid-1" },
      ctxError: { message: "db down" },
    });
    const provider = new FirebaseIdentityProvider(
      () => auth as any,
      () => db as any,
      () => null,
    );
    await expect(provider.getSessionFromBearerToken("valid-token")).rejects.toBeTruthy();
  });
});

describe("resolveActiveIdentityProviderKind", () => {
  it("defaults to supabase when IDENTITY_PROVIDER is unset", () => {
    expect(resolveActiveIdentityProviderKind({})).toBe("supabase");
  });

  it("defaults to supabase for any unrecognized value (never fails open to firebase)", () => {
    expect(resolveActiveIdentityProviderKind({ IDENTITY_PROVIDER: "typo" })).toBe("supabase");
  });

  it("resolves firebase only on an exact match", () => {
    expect(resolveActiveIdentityProviderKind({ IDENTITY_PROVIDER: "firebase" })).toBe("firebase");
  });
});
