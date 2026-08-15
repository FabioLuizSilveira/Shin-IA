// Content-integrity hash for rendered contract text — same unkeyed SHA-256
// pattern as packages/commercial-platform/src/hash.ts (duplicated here, not
// imported: different domain, the function is small enough that a cross-
// package dependency would be artificial).
export async function hashContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
