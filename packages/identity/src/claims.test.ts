import { describe, expect, it } from "vitest";
import { identityFromAccessToken } from "./claims.js";

function fakeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.sig`;
}

describe("identityFromAccessToken", () => {
  it("maps every custom_access_token_hook claim onto ShinaIdentity", () => {
    const token = fakeJwt({
      sub: "user-1",
      email: "a@b.com",
      tenant_id: "tenant-1",
      tenant_role: "tenant_owner",
      platform_role: "platform_owner",
      mfa_enrolled: true,
      platform_subscription_status: "active",
      mkt_subscription_status: "active",
      platform_contract_current: true,
    });

    expect(identityFromAccessToken(token, "fallback", null)).toEqual({
      uid: "user-1",
      email: "a@b.com",
      tenantId: "tenant-1",
      tenantRole: "tenant_owner",
      platformRole: "platform_owner",
      mfaEnrolled: true,
      platformSubscriptionStatus: "active",
      mktSubscriptionStatus: "active",
      platformContractCurrent: true,
    });
  });

  it("falls back to safe defaults for absent claims", () => {
    const token = fakeJwt({ sub: "user-2" });
    expect(identityFromAccessToken(token, "fallback", "fallback@e.com")).toEqual({
      uid: "user-2",
      email: "fallback@e.com",
      tenantId: null,
      tenantRole: null,
      platformRole: null,
      mfaEnrolled: false,
      platformSubscriptionStatus: null,
      mktSubscriptionStatus: null,
      platformContractCurrent: false,
    });
  });

  it("falls back to the caller-supplied uid/email on a malformed token", () => {
    expect(identityFromAccessToken("not-a-jwt", "fallback-uid", "fallback@e.com")).toEqual({
      uid: "fallback-uid",
      email: "fallback@e.com",
      tenantId: null,
      tenantRole: null,
      platformRole: null,
      mfaEnrolled: false,
      platformSubscriptionStatus: null,
      mktSubscriptionStatus: null,
      platformContractCurrent: false,
    });
  });
});
