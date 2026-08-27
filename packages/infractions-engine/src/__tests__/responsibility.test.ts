import { describe, it, expect } from "vitest";
import { suggestResponsibility } from "../responsibility.js";
import type { ResponsibilityInput } from "../types.js";

function baseInput(overrides: Partial<ResponsibilityInput> = {}): ResponsibilityInput {
  return {
    occurredAt: "2026-08-22T14:37:00Z",
    contract: null,
    customerId: null,
    operation: null,
    allocation: null,
    operatorAssignment: null,
    trackingConfirmed: false,
    ...overrides,
  };
}

describe("suggestResponsibility", () => {
  it("suggests the operator when an assignment covers the operation window, boosted by confirmation + tracking", () => {
    const result = suggestResponsibility(
      baseInput({
        operation: { id: "op-1", startsAt: "2026-08-22T14:00:00Z", endsAt: "2026-08-22T16:00:00Z" },
        operatorAssignment: { operatorId: "operator-1", status: "confirmed" },
        trackingConfirmed: true,
      }),
    );
    expect(result.responsibleType).toBe("operator");
    expect(result.responsibleId).toBe("operator-1");
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.reasons.length).toBeGreaterThan(1);
  });

  it("does not suggest a declined operator assignment", () => {
    const result = suggestResponsibility(
      baseInput({
        operation: { id: "op-1", startsAt: "2026-08-22T14:00:00Z", endsAt: "2026-08-22T16:00:00Z" },
        operatorAssignment: { operatorId: "operator-1", status: "declined" },
        contract: {
          id: "c-1",
          organizationId: "org-1",
          periodStartsAt: "2026-08-01T00:00:00Z",
          periodEndsAt: "2026-08-31T00:00:00Z",
        },
        customerId: "customer-1",
      }),
    );
    expect(result.responsibleType).toBe("customer");
  });

  it("falls back to the contract's customer when no operator assignment covers the moment", () => {
    const result = suggestResponsibility(
      baseInput({
        contract: {
          id: "c-1",
          organizationId: "org-1",
          periodStartsAt: "2026-08-01T00:00:00Z",
          periodEndsAt: "2026-08-31T00:00:00Z",
        },
        customerId: "customer-1",
      }),
    );
    expect(result.responsibleType).toBe("customer");
    expect(result.responsibleId).toBe("customer-1");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("returns unknown with zero confidence when nothing covers the timestamp", () => {
    const result = suggestResponsibility(baseInput());
    expect(result).toEqual({
      responsibleType: "unknown",
      responsibleId: null,
      confidence: 0,
      reasons: ["no coverage found for the infraction timestamp"],
    });
  });

  it("does not suggest an operator when the assignment's operation window does not cover occurredAt", () => {
    const result = suggestResponsibility(
      baseInput({
        operation: { id: "op-1", startsAt: "2026-08-23T00:00:00Z", endsAt: "2026-08-23T23:59:00Z" },
        operatorAssignment: { operatorId: "operator-1", status: "confirmed" },
      }),
    );
    expect(result.responsibleType).toBe("unknown");
  });
});
