import { describe, it, expect } from "vitest";
import { computeCredits } from "./cost-policy.js";

describe("computeCredits", () => {
  it("computes cost from input/output token rates", () => {
    const { costUsd, credits } = computeCredits(
      1_000_000,
      1_000_000,
      { inputPerMTokUsd: 3, outputPerMTokUsd: 15 },
      1000,
    );
    expect(costUsd).toBeCloseTo(18, 6);
    expect(credits).toBeCloseTo(18_000, 3);
  });

  it("is zero for zero tokens", () => {
    expect(computeCredits(0, 0, { inputPerMTokUsd: 3, outputPerMTokUsd: 15 }, 1000)).toEqual({
      costUsd: 0,
      credits: 0,
    });
  });

  it("treats a missing rate as zero, not NaN/undefined", () => {
    const { costUsd } = computeCredits(1_000_000, 1_000_000, {}, 1000);
    expect(costUsd).toBe(0);
  });

  it("scales linearly with the credit multiplier", () => {
    const base = computeCredits(500_000, 0, { inputPerMTokUsd: 2 }, 1);
    const scaled = computeCredits(500_000, 0, { inputPerMTokUsd: 2 }, 500);
    expect(scaled.credits).toBeCloseTo(base.credits * 500, 6);
  });
});
