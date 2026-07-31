// custom_access_token_hook (supabase/migrations/20260047000000_auth_hook.sql)
// injects tenant_id/tenant_role/platform_role/mfa_enrolled into the issued
// JWT only — they're never written back to auth.users, so
// supabase.auth.getUser()'s returned .app_metadata never reflects them.
// Decode the access token itself (already verified by the getUser()/
// getSession() call that produced it) to read the real claims.
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
    // atob (not Buffer) so this works in both the Node and Edge runtimes —
    // middleware.ts may run on either depending on deployment config.
    const base64 = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as SessionClaims;
  } catch {
    return {};
  }
}
