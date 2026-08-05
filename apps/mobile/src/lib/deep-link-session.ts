import { getQueryParams } from "expo-auth-session/build/QueryParams";
import { supabase } from "./supabase";

// Handles the invite/magic-link email redirect (shinacustomer://auth/callback#access_token=...)
// sent by apps/web's "convidar cliente" flow (inviteUserByEmail) and by
// supabase.auth.signInWithOtp() magic-link sign-in — both land on this same
// deep link and carry access_token/refresh_token as URL fragment params.

// Security fix (MÉD-12): any URL matching the app's scheme used to be
// handed straight to setSession() with only "does it have both tokens"
// checked — no path/origin validation. A link from any source (another
// app, a webpage, an SMS) with a crafted access_token/refresh_token pair
// would silently authenticate this app as whatever account those tokens
// belong to (session fixation: the victim ends up acting as the
// attacker-controlled account). Only the one path this app's own
// invite/magic-link flow actually redirects to is now accepted.
const ALLOWED_PATH_PREFIX = "auth/callback";

function isAllowedCallbackUrl(url: string): boolean {
  const withoutFragment = url.split("#")[0];
  const schemeSplit = withoutFragment.split("://");
  if (schemeSplit.length < 2) return false;
  const pathPart = schemeSplit[1].split("?")[0].replace(/^\/+/, "").replace(/\/+$/, "");
  return pathPart === ALLOWED_PATH_PREFIX;
}

export async function createSessionFromUrl(url: string) {
  if (!isAllowedCallbackUrl(url)) return;

  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}
