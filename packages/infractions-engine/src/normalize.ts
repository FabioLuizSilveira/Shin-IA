// Plate normalization — strips anything that isn't a letter/digit and
// uppercases, so "ABC-1D23", "abc1d23", "ABC 1D23" all match the same
// asset. Mirrors the exact transform already run once in the
// 20260105000000 migration's backfill of assets.metadata->>'plate'.
export function normalizePlate(plate: string): string {
  return plate.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function normalizeRenavam(renavam: string): string {
  return renavam.replace(/\D/g, "");
}
