import { createClient } from "@/lib/supabase/server";
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
export async function requirePlatformRole(): Promise<
  { userId: string } | { error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Unauthorized", status: 401 };

  const claims = decodeSessionClaims(session.access_token);
  if (!claims.platform_role) return { error: "Forbidden", status: 403 };

  return { userId: session.user.id };
}
