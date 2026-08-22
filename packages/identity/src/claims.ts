import type { ShinaIdentity } from "./types.js";

// Deliberately duplicated from apps/web/src/lib/jwt-claims.ts rather than
// imported: that file is already depended on by ~15 route/lib files
// outside this package's reach (apps/web can't import from another app's
// src/, and apps/mkt/apps/mobile have their own copies of the same JWT
// shape). This package is meant to be swappable infrastructure, not a
// dependency of the app-local file — see docs/architecture/
// IDENTITY_PROVIDER_ABSTRACTION.md for why the duplication was chosen over
// a forced extraction.
interface RawSessionClaims {
  sub?: string;
  email?: string;
  tenant_id?: string | null;
  tenant_role?: string | null;
  platform_role?: string | null;
  mfa_enrolled?: boolean;
  platform_subscription_status?: string | null;
  mkt_subscription_status?: string | null;
  platform_contract_current?: boolean;
}

function decodeRawClaims(accessToken: string): RawSessionClaims {
  try {
    const base64 = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as RawSessionClaims;
  } catch {
    return {};
  }
}

export function identityFromAccessToken(
  accessToken: string,
  fallbackUserId: string,
  fallbackEmail: string | null,
): ShinaIdentity {
  const claims = decodeRawClaims(accessToken);
  return {
    uid: claims.sub ?? fallbackUserId,
    email: claims.email ?? fallbackEmail,
    tenantId: claims.tenant_id ?? null,
    tenantRole: claims.tenant_role ?? null,
    platformRole: claims.platform_role ?? null,
    mfaEnrolled: claims.mfa_enrolled ?? false,
    platformSubscriptionStatus: claims.platform_subscription_status ?? null,
    mktSubscriptionStatus: claims.mkt_subscription_status ?? null,
    platformContractCurrent: claims.platform_contract_current ?? false,
  };
}
