import { describe, it, expect } from "vitest";
import { resolveAssetMatch } from "../matching.js";
import type { AssetMatchCandidate } from "../types.js";

const candidates: AssetMatchCandidate[] = [
  { assetId: "asset-1", tenantId: "tenant-1", plate: "ABC1D23", renavam: "12345678900" },
  { assetId: "asset-2", tenantId: "tenant-1", plate: "XYZ9W88", renavam: "99988877766" },
];

describe("resolveAssetMatch", () => {
  it("matches exact renavam over plate", () => {
    const result = resolveAssetMatch("123.456.789-00", "ZZZ0000", candidates);
    expect(result).toEqual({
      confidence: "exact_renavam",
      assetId: "asset-1",
      tenantId: "tenant-1",
      candidateCount: 1,
    });
  });

  it("matches exact plate when no renavam given", () => {
    const result = resolveAssetMatch(null, "abc-1d23", candidates);
    expect(result.confidence).toBe("exact_plate");
    expect(result.assetId).toBe("asset-1");
  });

  it("returns not_found when nothing matches", () => {
    const result = resolveAssetMatch(null, "NOPE000", candidates);
    expect(result).toEqual({
      confidence: "not_found",
      assetId: null,
      tenantId: null,
      candidateCount: 0,
    });
  });

  it("returns ambiguous, never auto-picks, when multiple candidates share a plate", () => {
    const dup: AssetMatchCandidate[] = [
      { assetId: "asset-1", tenantId: "tenant-1", plate: "ABC1D23", renavam: null },
      { assetId: "asset-3", tenantId: "tenant-2", plate: "ABC1D23", renavam: null },
    ];
    const result = resolveAssetMatch(null, "ABC1D23", dup);
    expect(result.confidence).toBe("ambiguous");
    expect(result.assetId).toBeNull();
    expect(result.candidateCount).toBe(2);
  });

  it("returns ambiguous when multiple candidates share a renavam", () => {
    const dup: AssetMatchCandidate[] = [
      { assetId: "asset-1", tenantId: "tenant-1", plate: "AAA1111", renavam: "111" },
      { assetId: "asset-2", tenantId: "tenant-1", plate: "BBB2222", renavam: "111" },
    ];
    const result = resolveAssetMatch("111", "ZZZ0000", dup);
    expect(result.confidence).toBe("ambiguous");
    expect(result.assetId).toBeNull();
  });
});
