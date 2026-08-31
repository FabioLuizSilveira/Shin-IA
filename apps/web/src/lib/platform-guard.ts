import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeSessionClaims } from "@/lib/jwt-claims";

// platform_roles/permissions tables have no RLS — "only accessible via
// service role" per their own migration comments — so every route that
// touches them must check platform_role itself before using the admin
// client, instead of relying on RLS to scope access.
//
// Deliberately uses getSession() + decodeSessionClaims() instead of
// getUser(): getUser() revalidates against the Auth server's /user
// endpoint, which returns auth.users' stored app_metadata column — NOT
// the claims custom_access_token_hook injects into the issued JWT. See
// jwt-claims.ts for details.
//
// Bearer-token branch added when the CRM module's own live verification
// found this was the only "require*Scope" guard in the codebase with no
// Bearer support at all (requireTenantScope()/requireMobileContext()
// both have one, for the mobile app) -- every platform-side route
// (/api/tenants, /api/platform-settings/*, /api/platform-crm/*, ...)
// was reachable only from a real browser cookie session, silently
// unreachable from any headless/API client. Same shape as
// SupabaseIdentityProvider.getSessionFromBearerToken(): validate the
// token via a real admin.auth.getUser(token) round trip (never trust an
// unverified bearer string), then decode claims from that same
// already-validated token.
export async function requirePlatformRole(): Promise<
  { userId: string } | { error: string; status: number }
> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice("bearer ".length).trim()
    : null;

  if (bearerToken) {
    const admin = createAdminClient();
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(bearerToken);
    if (error || !user) return { error: "Unauthorized", status: 401 };

    const claims = decodeSessionClaims(bearerToken);
    if (!claims.platform_role) return { error: "Forbidden", status: 403 };
    return { userId: user.id };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthorized", status: 401 };

  const claims = decodeSessionClaims(session.access_token);
  if (!claims.platform_role) return { error: "Forbidden", status: 403 };

  return { userId: session.user.id };
}
