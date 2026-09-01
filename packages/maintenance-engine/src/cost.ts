// Pure sum, mirrors maintenance_orders.total_cost_cents' generated column
// exactly (labor + parts + other) -- used for a live preview in the UI
// before the row is ever written; the DB column stays the source of truth
// for anything already persisted, this is never re-derived from stored
// data to avoid two slightly-different implementations drifting apart.
export function sumCostsCents(
  laborCostCents: number,
  partsCostCents: number,
  otherCostCents: number,
): number {
  return laborCostCents + partsCostCents + otherCostCents;
}

// Etapa 4 (KPIs: "maintenance cost / km", "maintenance cost / hour") --
// null when the denominator is missing or zero rather than throwing or
// silently returning Infinity/NaN, since a lot of asset categories never
// have an odometer at all (item 20: never assume "vehicle").
export function costPerUnit(totalCostCents: number, unit: number | null): number | null {
  if (unit === null || unit <= 0) return null;
  return totalCostCents / unit;
}

// Etapa 4 (downtime/MTTR). Returns hours, null if either bound is missing
// or the range is inverted (defensive -- the DB has a check constraint
// for this too, this just protects a caller building a preview before
// the row exists).
export function downtimeHours(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / (1000 * 60 * 60);
}
