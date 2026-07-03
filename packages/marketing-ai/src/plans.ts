import type { MktPlan } from "./types.js";

// Config-driven plan limits. -1 means unlimited.

export interface MktPlanLimits {
  users: number;
  brandKits: number;
  adLibrarySearchesPerDay: number;
  swipeFileItems: number;
  aiGenerationsPerMonth: number;
  adClonesPerMonth: number;
  adIntegrations: number;
  competitorMonitors: number;
  mcpServer: boolean;
  byok: boolean;
  publicApi: boolean;
  whiteLabel: boolean;
  creditsIncluded: number;
}

export const MKT_PLAN_LIMITS: Record<MktPlan, MktPlanLimits> = {
  free: {
    users: 1,
    brandKits: 1,
    adLibrarySearchesPerDay: 5,
    swipeFileItems: 50,
    aiGenerationsPerMonth: 5,
    adClonesPerMonth: 0,
    adIntegrations: 0,
    competitorMonitors: 1,
    mcpServer: false,
    byok: false,
    publicApi: false,
    whiteLabel: false,
    creditsIncluded: 500,
  },
  starter: {
    users: 3,
    brandKits: 3,
    adLibrarySearchesPerDay: -1,
    swipeFileItems: -1,
    aiGenerationsPerMonth: 100,
    adClonesPerMonth: 20,
    adIntegrations: 1,
    competitorMonitors: 5,
    mcpServer: false,
    byok: true,
    publicApi: false,
    whiteLabel: false,
    creditsIncluded: 10_000,
  },
  pro: {
    users: 15,
    brandKits: 15,
    adLibrarySearchesPerDay: -1,
    swipeFileItems: -1,
    aiGenerationsPerMonth: -1,
    adClonesPerMonth: -1,
    adIntegrations: -1,
    competitorMonitors: 20,
    mcpServer: true,
    byok: true,
    publicApi: false,
    whiteLabel: false,
    creditsIncluded: 100_000,
  },
  business: {
    users: -1,
    brandKits: -1,
    adLibrarySearchesPerDay: -1,
    swipeFileItems: -1,
    aiGenerationsPerMonth: -1,
    adClonesPerMonth: -1,
    adIntegrations: -1,
    competitorMonitors: -1,
    mcpServer: true,
    byok: true,
    publicApi: true,
    whiteLabel: true,
    creditsIncluded: 500_000,
  },
  enterprise: {
    users: -1,
    brandKits: -1,
    adLibrarySearchesPerDay: -1,
    swipeFileItems: -1,
    aiGenerationsPerMonth: -1,
    adClonesPerMonth: -1,
    adIntegrations: -1,
    competitorMonitors: -1,
    mcpServer: true,
    byok: true,
    publicApi: true,
    whiteLabel: true,
    creditsIncluded: -1,
  },
};

export function planAllows(plan: MktPlan, feature: keyof MktPlanLimits): boolean {
  const value = MKT_PLAN_LIMITS[plan][feature];
  return typeof value === "boolean" ? value : value !== 0;
}

export function withinLimit(plan: MktPlan, feature: keyof MktPlanLimits, current: number): boolean {
  const limit = MKT_PLAN_LIMITS[plan][feature];
  if (typeof limit === "boolean") return limit;
  return limit === -1 || current < limit;
}
