import type { RevenueEntry } from "./types.js";

export function computeGrossProfit(entry: RevenueEntry): number {
  return entry.gross - entry.costs - entry.commissions;
}

export function computeGrowthRate(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function summarizeRevenue(entries: RevenueEntry[]): {
  totalGross: number;
  totalCosts: number;
  totalCommissions: number;
  totalProfit: number;
} {
  const totalGross = entries.reduce((s, e) => s + e.gross, 0);
  const totalCosts = entries.reduce((s, e) => s + e.costs, 0);
  const totalCommissions = entries.reduce((s, e) => s + e.commissions, 0);
  return {
    totalGross,
    totalCosts,
    totalCommissions,
    totalProfit: totalGross - totalCosts - totalCommissions,
  };
}

export function findBestPeriod(entries: RevenueEntry[]): RevenueEntry | null {
  if (entries.length === 0) return null;
  return entries.reduce((best, e) => (computeGrossProfit(e) > computeGrossProfit(best) ? e : best));
}
