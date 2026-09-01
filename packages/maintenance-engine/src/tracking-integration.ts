// Tracking -> Maintenance integration (Etapa 10). GPS-derived odometer:
// each new position fix advances a linked asset's odometer by the
// great-circle distance from the previous fix. Deterministic geometry, no
// ML, but GPS fixes are noisy -- naively summing raw distance would
// inflate a stationary asset's odometer from jitter alone. Two filters,
// same "never present false precision" discipline as the rest of this
// package:
//   - below MIN_MOVEMENT_KM: almost certainly GPS noise, not real travel.
//   - implied speed above MAX_PLAUSIBLE_SPEED_KMH: almost certainly a bad
//     fix (multipath/teleport), not a real jump.
// Either filter rejects the whole delta (0 km added), never a clamped
// guess at "what it probably really was".

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TimestampedFix extends Coordinates {
  fixedAt: string;
}

const EARTH_RADIUS_KM = 6371;
const MIN_MOVEMENT_KM = 0.02; // ~20m
const MAX_PLAUSIBLE_SPEED_KMH = 180;

export type OdometerDeltaRejectionReason =
  | "no_previous_fix"
  | "below_noise_threshold"
  | "implausible_speed";

export interface OdometerDeltaResult {
  distanceKm: number; // 0 whenever accepted is false
  accepted: boolean;
  reason: OdometerDeltaRejectionReason | "ok";
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computeOdometerDelta(
  previous: TimestampedFix | null,
  current: TimestampedFix,
): OdometerDeltaResult {
  if (!previous) {
    return { distanceKm: 0, accepted: false, reason: "no_previous_fix" };
  }

  const distanceKm = haversineDistanceKm(previous, current);
  if (distanceKm < MIN_MOVEMENT_KM) {
    return { distanceKm: 0, accepted: false, reason: "below_noise_threshold" };
  }

  const elapsedHours =
    (new Date(current.fixedAt).getTime() - new Date(previous.fixedAt).getTime()) / 3_600_000;
  if (elapsedHours > 0) {
    const impliedSpeedKmh = distanceKm / elapsedHours;
    if (impliedSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH) {
      return { distanceKm: 0, accepted: false, reason: "implausible_speed" };
    }
  }

  return { distanceKm, accepted: true, reason: "ok" };
}
