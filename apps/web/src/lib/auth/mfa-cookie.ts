// Signed MFA-verified cookie. The value is `${exp}.${hmac(userId + exp)}`,
// so it cannot be forged client-side and is bound to one user and a deadline.
// Uses Web Crypto only, so it runs in both the edge middleware and node routes.

export const MFA_COOKIE_NAME = "mfa_verified";
export const MFA_COOKIE_TTL_SECONDS = 86_400; // 24h

function secret(): string {
  return process.env.MFA_COOKIE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
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

export async function signMfaCookie(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MFA_COOKIE_TTL_SECONDS;
  const sig = await hmacBase64Url(`${userId}.${exp}`);
  return `${exp}.${sig}`;
}

export async function verifyMfaCookie(token: string, userId: string): Promise<boolean> {
  if (!secret()) return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() || !sig) return false;

  const expected = await hmacBase64Url(`${userId}.${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}
