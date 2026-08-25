// Content-integrity hash — same unkeyed SHA-256 pattern already used by
// packages/tenant-contract-engine/src/hash.ts and packages/commercial-
// platform/src/hash.ts (duplicated here, not imported, for the same
// reason both of those give: different domain, small enough that a
// cross-package dependency would be artificial). Used for
// inspection_reports.content_hash and inspection_media.checksum_sha256.
export async function hashContent(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
