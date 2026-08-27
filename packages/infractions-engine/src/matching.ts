import type { AssetMatchCandidate, AssetMatchResult } from "./types.js";
import { normalizePlate, normalizeRenavam } from "./normalize.js";

// Asset matching (item 9 of the spec). Pure function over already-fetched
// candidates (the caller queries assets by normalized plate/renavam and
// hands the rows here) — never associates automatically when there's
// relevant ambiguity (item 9: "Nunca associar automaticamente se houver
// ambiguidade relevante"). RENAVAM wins over plate when both are present,
// since plates can be reassigned/reused across vehicles over time but
// RENAVAM is the more stable identifier.
export function resolveAssetMatch(
  renavam: string | null,
  plate: string,
  candidates: AssetMatchCandidate[],
): AssetMatchResult {
  const normalizedPlate = normalizePlate(plate);
  const normalizedRenavam = renavam ? normalizeRenavam(renavam) : null;

  if (normalizedRenavam) {
    const byRenavam = candidates.filter(
      (c) => c.renavam && normalizeRenavam(c.renavam) === normalizedRenavam,
    );
    if (byRenavam.length === 1) {
      return {
        confidence: "exact_renavam",
        assetId: byRenavam[0].assetId,
        tenantId: byRenavam[0].tenantId,
        candidateCount: 1,
      };
    }
    if (byRenavam.length > 1) {
      return {
        confidence: "ambiguous",
        assetId: null,
        tenantId: null,
        candidateCount: byRenavam.length,
      };
    }
  }

  const byPlate = candidates.filter((c) => c.plate && normalizePlate(c.plate) === normalizedPlate);
  if (byPlate.length === 1) {
    return {
      confidence: "exact_plate",
      assetId: byPlate[0].assetId,
      tenantId: byPlate[0].tenantId,
      candidateCount: 1,
    };
  }
  if (byPlate.length > 1) {
    return {
      confidence: "ambiguous",
      assetId: null,
      tenantId: null,
      candidateCount: byPlate.length,
    };
  }

  return { confidence: "not_found", assetId: null, tenantId: null, candidateCount: 0 };
}
