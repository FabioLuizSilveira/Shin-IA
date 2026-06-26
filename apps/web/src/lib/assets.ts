import type { Asset, AssetStatus } from "./types.js";

export function computeFleetHealthScore(assets: Asset[]): number {
  if (assets.length === 0) return 0;
  const active = assets.filter((a) => a.status === "available" || a.status === "rented");
  return Math.round((active.length / assets.length) * 100);
}

export function categorizeByStatus(assets: Asset[]): Record<AssetStatus, Asset[]> {
  return {
    available: assets.filter((a) => a.status === "available"),
    rented: assets.filter((a) => a.status === "rented"),
    maintenance: assets.filter((a) => a.status === "maintenance"),
    retired: assets.filter((a) => a.status === "retired"),
  };
}

export function averageUtilization(assets: Asset[]): number {
  if (assets.length === 0) return 0;
  const sum = assets.reduce((acc, a) => acc + a.utilizationPercent, 0);
  return sum / assets.length;
}

export function filterByCategory(assets: Asset[], category: string): Asset[] {
  return assets.filter((a) => a.category === category);
}
