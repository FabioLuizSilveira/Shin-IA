// Canonical identity/session shape the rest of the platform should depend
// on instead of Supabase's own User/Session types. Fields mirror exactly
// what custom_access_token_hook (supabase/migrations/20260047000000_auth_hook.sql)
// injects into the issued JWT today — this is a rename/reshape of the
// already-proven claim set, not a new data model.
export interface ShinaIdentity {
  uid: string;
  email: string | null;
  tenantId: string | null;
  tenantRole: string | null;
  platformRole: string | null;
  mfaEnrolled: boolean;
  platformSubscriptionStatus: string | null;
  mktSubscriptionStatus: string | null;
  platformContractCurrent: boolean;
}

export interface ShinaSession {
  identity: ShinaIdentity;
  // Kept only because a handful of call sites still need to pass the raw
  // token onward (e.g. to re-decode claims, or to a downstream service) —
  // not meant to be read directly by new code.
  accessToken: string;
}
