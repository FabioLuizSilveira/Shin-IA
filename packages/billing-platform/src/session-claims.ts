// Edge-safe JWT claims decode, shared by both apps' middleware. Mirrors
// apps/web/src/lib/jwt-claims.ts (which apps/web keeps for its many local
// importers); apps/mkt has no local equivalent and imports this one.
export interface SessionClaims {
  tenant_id?: string | null;
  tenant_role?: string | null;
  platform_role?: string | null;
  mfa_enrolled?: boolean;
  platform_subscription_status?: string | null;
  mkt_subscription_status?: string | null;
}

export function decodeSessionClaims(accessToken: string): SessionClaims {
  try {
    // atob (not Buffer) so this works in both Node and Edge runtimes.
    const base64 = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as SessionClaims;
  } catch {
    return {};
  }
}

const LIVE_STATUSES = new Set(["trialing", "active"]);

// Central entitlement rule: a subscription grants access while trialing or
// active. past_due deliberately still blocks — Fase 1 keeps it strict; a
// grace period would be a product decision layered here later.
export function hasLiveSubscription(status: string | null | undefined): boolean {
  return !!status && LIVE_STATUSES.has(status);
}
