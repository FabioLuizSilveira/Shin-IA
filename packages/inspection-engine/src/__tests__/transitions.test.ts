import { describe, it, expect } from "vitest";
import { canTransition, ALLOWED_TRANSITIONS } from "../transitions.js";
import type { InspectionStatus } from "../types.js";

describe("inspection status transitions", () => {
  it("allows the real lifecycle path", () => {
    expect(canTransition("draft", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "pending_review")).toBe(true);
    expect(canTransition("pending_review", "completed")).toBe(true);
    expect(canTransition("pending_review", "rejected")).toBe(true);
  });

  it("allows abandoning from draft or in_progress", () => {
    expect(canTransition("draft", "abandoned")).toBe(true);
    expect(canTransition("in_progress", "abandoned")).toBe(true);
  });

  it("blocks skipping straight to completed", () => {
    expect(canTransition("draft", "completed")).toBe(false);
    expect(canTransition("in_progress", "completed")).toBe(false);
  });

  it("terminal states have no outgoing transitions", () => {
    const terminal: InspectionStatus[] = ["completed", "rejected", "abandoned"];
    for (const status of terminal) {
      expect(ALLOWED_TRANSITIONS[status]).toEqual([]);
      expect(canTransition(status, "draft")).toBe(false);
      expect(canTransition(status, "in_progress")).toBe(false);
    }
  });

  it("blocks going backwards", () => {
    expect(canTransition("in_progress", "draft")).toBe(false);
    expect(canTransition("pending_review", "in_progress")).toBe(false);
  });
});
