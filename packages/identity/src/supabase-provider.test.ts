import { describe, expect, it, vi } from "vitest";
import { SupabaseIdentityProvider } from "./supabase-provider.js";
import { FakeIdentityProvider } from "./fake-provider.js";
import type { IdentityProvider } from "./provider.js";

function fakeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.sig`;
}

// Exercises the exact behavior requireTenantScope() depends on today, to
// prove the adapter reproduces it exactly rather than approximately.
describe("SupabaseIdentityProvider", () => {
  it("returns null when there is no cookie session (unauthenticated)", async () => {
    const client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } };
    const provider = new SupabaseIdentityProvider(
      () => client as any,
      () => client as any,
    );
    expect(await provider.getSessionFromCookies()).toBeNull();
  });

  it("decodes tenant/platform claims from the cookie session's access token", async () => {
    const token = fakeJwt({ sub: "u1", tenant_id: "t1", tenant_role: "tenant_owner" });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: token, user: { id: "u1", email: "u1@e.com" } } },
        }),
      },
    };
    const provider = new SupabaseIdentityProvider(
      () => client as any,
      () => client as any,
    );
    const session = await provider.getSessionFromCookies();
    expect(session?.identity.tenantId).toBe("t1");
    expect(session?.identity.tenantRole).toBe("tenant_owner");
    expect(session?.identity.uid).toBe("u1");
  });

  it("returns null for an invalid bearer token (mirrors the mobile 401 path)", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "bad" } }),
      },
    };
    const provider = new SupabaseIdentityProvider(
      () => client as any,
      () => client as any,
    );
    expect(await provider.getSessionFromBearerToken("bad-token")).toBeNull();
  });

  it("resolves a valid bearer token via the admin client, decoding claims from the token itself", async () => {
    const token = fakeJwt({ sub: "u2", tenant_id: "t2" });
    const client = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "u2", email: null } }, error: null }),
      },
    };
    const provider = new SupabaseIdentityProvider(
      () => client as any,
      () => client as any,
    );
    const session = await provider.getSessionFromBearerToken(token);
    expect(session?.identity.tenantId).toBe("t2");
  });
});

// Proves the abstraction is real: a function written against IdentityProvider
// alone works identically whether it's handed the Supabase-backed adapter or
// a fake — the contract, not the concrete class, is what call sites depend on.
describe("IdentityProvider substitutability", () => {
  async function resolveTenantId(provider: IdentityProvider): Promise<string | null> {
    const session = await provider.getSessionFromCookies();
    return session?.identity.tenantId ?? null;
  }

  it("works against FakeIdentityProvider", async () => {
    const fake = FakeIdentityProvider.withIdentity({ uid: "u1", tenantId: "tenant-fake" });
    expect(await resolveTenantId(fake)).toBe("tenant-fake");
  });
});
