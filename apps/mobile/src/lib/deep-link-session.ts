import { getQueryParams } from "expo-auth-session/build/QueryParams";
import { supabase } from "./supabase";

// Handles the invite/magic-link email redirect (shinacustomer://auth/callback#access_token=...)
// sent by apps/web's "convidar cliente" flow (inviteUserByEmail) and by
// supabase.auth.signInWithOtp() magic-link sign-in — both land on this same
// deep link and carry access_token/refresh_token as URL fragment params.
export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}
