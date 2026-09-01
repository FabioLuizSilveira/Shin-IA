import { describe, it, expect } from "vitest";
import { haversineDistanceKm, computeOdometerDelta } from "../tracking-integration.js";

// São Paulo-ish reference point; 0.009 deg of latitude ≈ 1km.
const BASE = { latitude: -23.5505, longitude: -46.6333 };
const ONE_KM_NORTH = { latitude: -23.5415, longitude: -46.6333 };

describe("haversineDistanceKm", () => {
  it("is 0 for the same point", () => {
    expect(haversineDistanceKm(BASE, BASE)).toBe(0);
  });

  it("computes a real-world distance within a small tolerance", () => {
    expect(haversineDistanceKm(BASE, ONE_KM_NORTH)).toBeCloseTo(1, 1);
  });

  it("is symmetric", () => {
    expect(haversineDistanceKm(BASE, ONE_KM_NORTH)).toBeCloseTo(
      haversineDistanceKm(ONE_KM_NORTH, BASE),
      6,
    );
  });
});

describe("computeOdometerDelta", () => {
  it("rejects with no_previous_fix when there is no prior position", () => {
    const result = computeOdometerDelta(null, { ...BASE, fixedAt: "2026-06-01T00:00:00Z" });
    expect(result).toEqual({ distanceKm: 0, accepted: false, reason: "no_previous_fix" });
  });

  it("accepts a plausible 1km move over a plausible time window", () => {
    const previous = { ...BASE, fixedAt: "2026-06-01T00:00:00Z" };
    const current = { ...ONE_KM_NORTH, fixedAt: "2026-06-01T00:02:00Z" }; // 1km in 2min = 30km/h
    const result = computeOdometerDelta(previous, current);
    expect(result.accepted).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.distanceKm).toBeCloseTo(1, 1);
  });

  it("rejects a sub-noise-threshold movement (GPS jitter while stationary)", () => {
    const previous = { ...BASE, fixedAt: "2026-06-01T00:00:00Z" };
    // ~1m of drift -- same point for all practical purposes.
    const current = {
      latitude: BASE.latitude + 0.00001,
      longitude: BASE.longitude,
      fixedAt: "2026-06-01T00:01:00Z",
    };
    const result = computeOdometerDelta(previous, current);
    expect(result).toEqual({ distanceKm: 0, accepted: false, reason: "below_noise_threshold" });
  });

  it("rejects an implausible speed (bad fix / teleport), never clamps a guess", () => {
    const previous = { ...BASE, fixedAt: "2026-06-01T00:00:00Z" };
    // 1km covered in 1 second -> 3600 km/h implied.
    const current = { ...ONE_KM_NORTH, fixedAt: "2026-06-01T00:00:01Z" };
    const result = computeOdometerDelta(previous, current);
    expect(result).toEqual({ distanceKm: 0, accepted: false, reason: "implausible_speed" });
  });

  it("accepts a speed comfortably under the plausible-speed limit and rejects one comfortably over it", () => {
    const previous = { ...BASE, fixedAt: "2026-06-01T00:00:00Z" };
    // 1km in 30 seconds -> ~120 km/h, comfortably under the 180 km/h limit.
    const underLimit = { ...ONE_KM_NORTH, fixedAt: "2026-06-01T00:00:30Z" };
    expect(computeOdometerDelta(previous, underLimit).accepted).toBe(true);

    // 1km in 10 seconds -> ~360 km/h, comfortably over the limit.
    const overLimit = { ...ONE_KM_NORTH, fixedAt: "2026-06-01T00:00:10Z" };
    expect(computeOdometerDelta(previous, overLimit).accepted).toBe(false);
  });

  it("never divides by zero when two fixes share the same timestamp", () => {
    const previous = { ...BASE, fixedAt: "2026-06-01T00:00:00Z" };
    const current = { ...ONE_KM_NORTH, fixedAt: "2026-06-01T00:00:00Z" };
    // Same timestamp, real distance -- elapsedHours is 0, the speed check
    // is skipped entirely (elapsedHours > 0 guard), so this still accepts
    // on distance alone rather than throwing/NaN-ing.
    const result = computeOdometerDelta(previous, current);
    expect(result.accepted).toBe(true);
    expect(Number.isFinite(result.distanceKm)).toBe(true);
  });
});
