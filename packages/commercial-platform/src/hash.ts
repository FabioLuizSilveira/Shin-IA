// Content-integrity hash for accepted contract text — same Web Crypto style
// as apps/web/src/lib/auth/mfa-recovery-hash.ts, but unkeyed (SHA-256 of the
// content itself, not an HMAC of a secret): this proves the document wasn't
// altered after acceptance, it isn't protecting a secret.
export async function hashContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
