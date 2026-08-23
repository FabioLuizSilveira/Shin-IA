import { cookies } from "next/headers";
import { STEPUP_COOKIE_NAME, verifyStepUpCookie } from "./stepup-cookie";

// Call from a sensitive route/server action after resolving the caller's
// identity (requireTenantScope()/identityProvider), passing the same
// shina_user_id — returns true only if that user completed
// POST /api/auth/mfa/native/challenge within the last
// STEPUP_COOKIE_TTL_SECONDS. Not wired to any route yet — no sensitive
// action has been chosen this round (explicit scope decision); this is
// the capability a future route gates on.
export async function hasValidStepUp(shinaUserId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STEPUP_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyStepUpCookie(token, shinaUserId);
}
