// Shinã-native TOTP (RFC 6238), independent of any auth provider — neither
// Supabase Auth's built-in MFA nor Firebase's multi-factor API is used.
// Decision (2026-08-22): login/signup never requires MFA; this is a
// step-up mechanism for specific sensitive actions, verified against the
// canonical shina_user_id, not a Supabase/Firebase session concept. Uses
// Web Crypto only (matches lib/auth/mfa-cookie.ts's HMAC pattern), no new
// dependency for the crypto itself.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(encoded: string): Uint8Array {
  const clean = encoded.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

// Generates a fresh 160-bit (20-byte) secret — the size every mainstream
// authenticator app (Google Authenticator, Authy, 1Password, etc.) expects.
export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

export function buildTotpUri(secretBase32: string, accountLabel: string, issuer = "Shina"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function intToBytes(counter: number): Uint8Array {
  // 64-bit big-endian counter, per RFC 4226 — split into two 32-bit halves
  // since JS bitwise ops are 32-bit; the high half is always 0 until the
  // year ~2554 at a 30s period.
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, 0);
  view.setUint32(4, counter, false);
  return new Uint8Array(buf);
}

async function hotp(secretBase32: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secretBase32);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const hmac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, intToBytes(counter) as BufferSource),
  );

  // Dynamic truncation (RFC 4226 §5.3).
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = (binCode % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
  return code;
}

// windowSteps=1 tolerates the code from one 30s step before/after "now" —
// the standard tolerance for authenticator-app clock drift, matching what
// most TOTP implementations (including Supabase's own, previously used
// here) default to.
export async function verifyTotpCode(
  secretBase32: string,
  code: string,
  windowSteps = 1,
  now: number = Date.now(),
): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const candidate = await hotp(secretBase32, counter + delta);
    if (candidate === code) return true;
  }
  return false;
}
