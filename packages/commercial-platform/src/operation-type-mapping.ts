import type { BusinessOperationType } from "./operation-profile.js";
import type { ResolverProfileInput } from "./blueprint-resolver.js";
import type { BusinessProfile } from "./business-profile.js";

// WAVE 2 — Multi-Operation Business Architecture v2: bridges the discovery
// catalog's vocabulary (`verticals.key`, e.g. "rental-cars", "guincho",
// "passenger-transport") to Wave 1's OperationProfile taxonomy
// (BusinessOperationType, e.g. "vehicle_rental", "towing_service",
// "passenger_transport"). Pure, deterministic, no DB access — this is
// RESOLUTION only (spec section 46's Wave 2 scope), not persistence.
// Actually creating operation_profiles rows from a confirmed BusinessProfile
// is Operation Runtime / Commercial territory (Waves 3-4).

const VERTICAL_TO_OPERATION_TYPE: Record<string, BusinessOperationType> = {
  "rental-cars": "vehicle_rental",
  "rental-motorcycles": "motorcycle_rental",
  guincho: "towing_service",
  "passenger-transport": "passenger_transport",
  "fleet-mobility": "vehicle_rental",
  forklift: "forklift_operation",
  munk: "munk_operation",
  crane: "crane_operation",
  "tower-crane": "crane_operation",
  agriculture: "agricultural_equipment",
  construction: "equipment_rental",
  "generic-assets": "other",
};

/** Best-effort mapping — an unknown/future vertical key falls back to "other" rather than throwing, since the discovery catalog is data-driven and can grow without a code change. */
export function mapVerticalToOperationType(vertical: string): BusinessOperationType {
  return VERTICAL_TO_OPERATION_TYPE[vertical] ?? "other";
}

export interface ResolvedOperationProfile {
  vertical: string;
  type: BusinessOperationType;
  role: "primary" | "secondary";
}

/**
 * Resolves the full set of operation profiles implied by a BusinessProfile's
 * primaryVertical + additionalVerticals — one entry per DISTINCT operation
 * type (two verticals mapping to the same type, e.g. fleet-mobility and
 * rental-cars both → vehicle_rental, collapse into a single profile so the
 * tenant doesn't end up with duplicate OperationProfiles for the same
 * business line). The primary vertical's type always wins the "primary"
 * role, even if an additional vertical maps to the same type.
 */
export function resolveOperationProfilesForProfile(
  profile: BusinessProfile | ResolverProfileInput,
): ResolvedOperationProfile[] {
  const primaryType = mapVerticalToOperationType(profile.primaryVertical);
  const seen = new Map<BusinessOperationType, ResolvedOperationProfile>();
  seen.set(primaryType, { vertical: profile.primaryVertical, type: primaryType, role: "primary" });

  for (const vertical of profile.additionalVerticals ?? []) {
    if (vertical === profile.primaryVertical) continue;
    const type = mapVerticalToOperationType(vertical);
    if (seen.has(type)) continue;
    seen.set(type, { vertical, type, role: "secondary" });
  }

  return [...seen.values()];
}
