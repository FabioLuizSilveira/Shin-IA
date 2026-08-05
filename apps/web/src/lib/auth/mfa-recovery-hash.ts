// Security fix (MÉD-15): mfa_recovery_codes.code_hash used to be
// Buffer.from(code).toString("base64") — encoding, not hashing, and
// trivially reversible if the table ever leaked (DB dump, backup exposure,
// log). HMAC-SHA256 with the same server-side secret used to sign the
// mfa_verified cookie (see lib/auth/mfa-cookie.ts) makes the stored value
// non-reversible without that secret. Web Crypto only, so it runs in both
// edge middleware and node API routes.

function secret(): string {
  return process.env.MFA_COOKIE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export async function hashRecoveryCode(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(normalized));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
