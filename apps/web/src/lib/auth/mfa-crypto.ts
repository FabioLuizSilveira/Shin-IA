// AES-256-GCM encryption for native TOTP secrets — same pattern as
// apps/mkt/src/lib/crypto.ts's BYOK key encryption, separate key so the
// two can be rotated independently.

function keyMaterial(): Uint8Array {
  const explicit = process.env.SHINA_MFA_ENCRYPTION_KEY;
  if (explicit) {
    const raw = Buffer.from(explicit, "base64");
    if (raw.length === 32) return new Uint8Array(raw);
  }
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bytes = new TextEncoder().encode(fallback.padEnd(32, "0"));
  return bytes.slice(0, 32);
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyMaterial() as BufferSource, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptTotpSecret(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return Buffer.from(packed).toString("base64");
}

export async function decryptTotpSecret(encoded: string): Promise<string> {
  const packed = new Uint8Array(Buffer.from(encoded, "base64"));
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const key = await importKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv } as AesGcmParams,
    key,
    ciphertext as BufferSource,
  );
  return new TextDecoder().decode(plaintext);
}
