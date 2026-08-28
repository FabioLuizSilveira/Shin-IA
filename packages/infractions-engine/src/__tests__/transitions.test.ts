import { describe, it, expect } from "vitest";
import { canTransitionCase, ALLOWED_CASE_TRANSITIONS } from "../transitions.js";
import type { InfractionCaseStatus } from "../types.js";

describe("canTransitionCase", () => {
  it("allows the real happy path", () => {
    const path: InfractionCaseStatus[] = [
      "received",
      "matching",
      "matched",
      "responsibility_pending",
      "responsibility_suggested",
      "responsibility_confirmed",
      "notified",
      "action_pending",
      "payment_pending",
      "paid",
      "closed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionCase(path[i], path[i + 1])).toBe(true);
    }
  });

  it("allows unmatched -> matching for reprocessing (item 32)", () => {
    expect(canTransitionCase("unmatched", "matching")).toBe(true);
  });

  it("allows matched -> responsibility_suggested directly -- the real path POST .../responsibility/suggest uses", () => {
    expect(canTransitionCase("matched", "responsibility_suggested")).toBe(true);
  });

  it("allows re-suggesting while already responsibility_suggested (idempotent re-run)", () => {
    expect(canTransitionCase("responsibility_suggested", "responsibility_suggested")).toBe(true);
  });

  it("allows the real routes' direct paths past confirmation -- notified/action_pending/payment_pending are real enum values no route ever writes", () => {
    // driver-identification POST
    expect(canTransitionCase("responsibility_confirmed", "driver_identification_pending")).toBe(
      true,
    );
    // defense POST, straight after confirmation (no driver-id step)
    expect(canTransitionCase("responsibility_confirmed", "defense_pending")).toBe(true);
    // payment route, at every real stage a payment can land
    expect(canTransitionCase("responsibility_confirmed", "paid")).toBe(true);
    expect(canTransitionCase("driver_identification_pending", "paid")).toBe(true);
    expect(canTransitionCase("driver_identified", "paid")).toBe(true);
    expect(canTransitionCase("defense_pending", "paid")).toBe(true);
    expect(canTransitionCase("appealed", "paid")).toBe(true);
  });

  it("rejects skipping straight from received to closed", () => {
    expect(canTransitionCase("received", "closed")).toBe(false);
  });

  it("closed is terminal", () => {
    expect(ALLOWED_CASE_TRANSITIONS.closed).toEqual([]);
  });

  it("rejects an unknown target state", () => {
    expect(canTransitionCase("received", "paid")).toBe(false);
  });
});
