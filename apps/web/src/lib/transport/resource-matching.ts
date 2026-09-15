// WAVE 3 — Multi-Operation Business Architecture v2: Operation Runtime.
// Pure matching helpers — no DB access. Vehicle capacity and driver
// capability live in assets.metadata / resources.metadata (both already
// jsonb columns) rather than a new capability table: Wave 1's audit
// confirmed no capability-matching schema exists live, and packages/
// resource-engine's CapabilityRequirement/MatchResult types target a
// resource_calendar table that was never built — reusing that dead code's
// shape (not its implementation) as the reference design, per the audit's
// own recommendation.

export interface AssetForMatching {
  id: string;
  status: string;
  metadata: { seatCapacity?: number; fleetType?: string } & Record<string, unknown>;
}

export interface ResourceForMatching {
  id: string;
  type: string;
  status: string;
  metadata: { licenseCategory?: string; canOperateFleetTypes?: string[] } & Record<string, unknown>;
}

/** Vehicles with enough seats for the requested passenger count, available today (not maintenance/decommissioned/in_use). */
export function matchVehiclesForCapacity(
  assets: AssetForMatching[],
  passengerCount: number,
): AssetForMatching[] {
  return assets.filter((a) => {
    if (a.status !== "available") return false;
    const capacity = a.metadata.seatCapacity;
    return typeof capacity === "number" && capacity >= passengerCount;
  });
}

/**
 * Drivers available for a given fleet type. A driver whose metadata doesn't
 * declare canOperateFleetTypes is treated as unrestricted (no capability
 * data recorded yet — never silently EXCLUDED for missing data, since that
 * would make onboarding a driver a prerequisite for every match; the
 * schedule-level dispatcher still reviews the match before confirming).
 */
export function matchDriversForFleetType(
  resources: ResourceForMatching[],
  fleetType: string | undefined,
): ResourceForMatching[] {
  return resources.filter((r) => {
    if (r.type !== "driver") return false;
    if (r.status !== "available") return false;
    const allowed = r.metadata.canOperateFleetTypes;
    if (!fleetType || !allowed || allowed.length === 0) return true;
    return allowed.includes(fleetType);
  });
}
