import { describe, it, expect } from "vitest";
import { resolveReportPeriod, isReportPeriodError } from "../../lib/mobile-report-period";

describe("resolveReportPeriod", () => {
  it("defaults to 30d when no range param is given", () => {
    const period = resolveReportPeriod(new URLSearchParams());
    expect(isReportPeriodError(period)).toBe(false);
    if (!isReportPeriodError(period)) {
      const spanDays =
        (new Date(period.end).getTime() - new Date(period.start).getTime()) / 86400000;
      expect(spanDays).toBeCloseTo(30, 0);
    }
  });

  it.each([
    ["today", 1],
    ["7d", 7],
    ["30d", 30],
    ["90d", 90],
  ])("range=%s resolves to a %d-day window", (range, days) => {
    const period = resolveReportPeriod(new URLSearchParams({ range }));
    expect(isReportPeriodError(period)).toBe(false);
    if (!isReportPeriodError(period)) {
      const spanDays =
        (new Date(period.end).getTime() - new Date(period.start).getTime()) / 86400000;
      expect(spanDays).toBeCloseTo(days, 0);
    }
  });

  it("range=custom with a valid from/to within the max window resolves", () => {
    const period = resolveReportPeriod(
      new URLSearchParams({ range: "custom", from: "2026-01-01", to: "2026-01-15" }),
    );
    expect(period).toEqual({ start: "2026-01-01T00:00:00.000Z", end: "2026-01-15T00:00:00.000Z" });
  });

  it("range=custom without from/to is rejected", () => {
    const period = resolveReportPeriod(new URLSearchParams({ range: "custom" }));
    expect(isReportPeriodError(period)).toBe(true);
  });

  it("range=custom exceeding the max window (90 days) is rejected, not silently clamped", () => {
    const period = resolveReportPeriod(
      new URLSearchParams({ range: "custom", from: "2020-01-01", to: "2026-01-01" }),
    );
    expect(isReportPeriodError(period)).toBe(true);
  });

  it("range=custom with to before from is rejected", () => {
    const period = resolveReportPeriod(
      new URLSearchParams({ range: "custom", from: "2026-01-15", to: "2026-01-01" }),
    );
    expect(isReportPeriodError(period)).toBe(true);
  });

  it("an unknown range value is rejected, not silently defaulted", () => {
    const period = resolveReportPeriod(new URLSearchParams({ range: "forever" }));
    expect(isReportPeriodError(period)).toBe(true);
  });
});
