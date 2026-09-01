import { describe, it, expect } from "vitest";
import { canTransitionOrder, ALLOWED_ORDER_TRANSITIONS } from "../transitions.js";
import type { MaintenanceOrderStatus } from "../types.js";

describe("canTransitionOrder", () => {
  it("allows the full approval-driven happy path", () => {
    const path: MaintenanceOrderStatus[] = [
      "scheduled",
      "awaiting_approval",
      "approved",
      "in_progress",
      "completed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionOrder(path[i], path[i + 1])).toBe(true);
    }
  });

  it("allows an emergency order to skip straight to in_progress", () => {
    expect(canTransitionOrder("scheduled", "in_progress")).toBe(true);
  });

  it("allows cancelling from any active (non-terminal-only) state", () => {
    for (const s of [
      "scheduled",
      "awaiting_approval",
      "approved",
      "in_progress",
    ] as MaintenanceOrderStatus[]) {
      expect(canTransitionOrder(s, "cancelled")).toBe(true);
    }
  });

  it("allows correcting a completed order back to in_progress", () => {
    expect(canTransitionOrder("completed", "in_progress")).toBe(true);
  });

  it("rejects a completed order regressing to scheduled", () => {
    expect(canTransitionOrder("completed", "scheduled")).toBe(false);
  });

  it("allows reinstating a cancelled order", () => {
    expect(canTransitionOrder("cancelled", "scheduled")).toBe(true);
  });

  it("rejects a cancelled order jumping straight to completed", () => {
    expect(canTransitionOrder("cancelled", "completed")).toBe(false);
  });

  it("rejects skipping straight from scheduled to completed", () => {
    expect(canTransitionOrder("scheduled", "completed")).toBe(false);
  });

  it("every declared status has a map entry", () => {
    const statuses: MaintenanceOrderStatus[] = [
      "scheduled",
      "awaiting_approval",
      "approved",
      "in_progress",
      "completed",
      "cancelled",
    ];
    for (const s of statuses) expect(ALLOWED_ORDER_TRANSITIONS[s]).toBeDefined();
  });
});
