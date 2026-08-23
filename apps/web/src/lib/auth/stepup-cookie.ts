// Signed step-up-verified cookie — same scheme as mfa-cookie.ts
// (`${exp}.${hmac(userId + exp)}`), separate cookie/name/secret so a
// step-up verification (short-lived, for one sensitive action) is
// independent from the older aal2-style mfa_verified cookie. Web Crypto
// only, runs in both edge middleware and node routes.

export const STEPUP_COOKIE_NAME = "shina_stepup_verified";
// Deliberately much shorter than MFA_COOKIE_TTL_SECONDS (24h) — a step-up
// proves "you have the authenticator right now, for this one action," not
// "you're MFA-verified for the rest of the day."
export const STEPUP_COOKIE_TTL_SECONDS = 5 * 60; // 5 minutes

function secret(): string {
  return process.env.SHINA_STEPUP_COOKIE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

async function hmacBase64Url(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function signStepUpCookie(shinaUserId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + STEPUP_COOKIE_TTL_SECONDS;
  const sig = await hmacBase64Url(`${shinaUserId}.${exp}`);
  return `${exp}.${sig}`;
}

export async function verifyStepUpCookie(token: string, shinaUserId: string): Promise<boolean> {
  if (!secret()) return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() || !sig) return false;

  const expected = await hmacBase64Url(`${shinaUserId}.${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}
