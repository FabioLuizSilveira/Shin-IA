import { describe, it, expect } from "vitest";
import { canTransitionLead, ALLOWED_LEAD_TRANSITIONS } from "../transitions.js";
import type { LeadStatus } from "../types.js";

describe("canTransitionLead", () => {
  it("allows the straightforward happy path", () => {
    const path: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "negotiation", "won"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransitionLead(path[i], path[i + 1])).toBe(true);
    }
  });

  it("allows qualifying directly from new, skipping contacted", () => {
    expect(canTransitionLead("new", "qualified")).toBe(true);
  });

  it("allows marking lost from every active stage", () => {
    for (const s of ["new", "contacted", "qualified", "proposal", "negotiation"] as LeadStatus[]) {
      expect(canTransitionLead(s, "lost")).toBe(true);
    }
  });

  it("allows reopening a lost lead back to contacted", () => {
    expect(canTransitionLead("lost", "contacted")).toBe(true);
  });

  it("rejects a lost lead jumping straight back to won", () => {
    expect(canTransitionLead("lost", "won")).toBe(false);
  });

  it("allows correcting a won deal back to negotiation", () => {
    expect(canTransitionLead("won", "negotiation")).toBe(true);
  });

  it("rejects won regressing all the way to new", () => {
    expect(canTransitionLead("won", "new")).toBe(false);
  });

  it("rejects skipping straight from new to won", () => {
    expect(canTransitionLead("new", "won")).toBe(false);
  });

  it("rejects an unknown/self transition that was never declared", () => {
    expect(canTransitionLead("qualified", "qualified")).toBe(false);
  });

  it("every declared status has an entry in the map (no silently-dead state)", () => {
    const statuses: LeadStatus[] = [
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ];
    for (const s of statuses) {
      expect(ALLOWED_LEAD_TRANSITIONS[s]).toBeDefined();
    }
  });
});
