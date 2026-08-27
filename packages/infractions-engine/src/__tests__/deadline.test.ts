import { describe, it, expect } from "vitest";
import { resolveDeadline, deadlineStatusFor } from "../deadline.js";

describe("resolveDeadline", () => {
  it("uses the provider-given due date when present", () => {
    const result = resolveDeadline({ deadlineType: "defense", dueAt: "2026-09-10T00:00:00Z" });
    expect(result).toEqual({
      dueAt: "2026-09-10T00:00:00Z",
      source: "provider",
      ruleVersion: null,
      baseDate: null,
    });
  });

  it("calculates a deadline only when base date + days + rule version are all given", () => {
    const result = resolveDeadline({
      deadlineType: "driver_identification",
      dueAt: null,
      baseDate: "2026-08-22",
      daysFromBase: 15,
      ruleVersion: "ctb-v1",
    });
    expect(result?.source).toBe("calculated");
    expect(result?.ruleVersion).toBe("ctb-v1");
    expect(result?.baseDate).toBe("2026-08-22");
    expect(new Date(result!.dueAt).toISOString().slice(0, 10)).toBe("2026-09-06");
  });

  it("never invents a deadline without a source (item 17) — returns null instead", () => {
    expect(resolveDeadline({ deadlineType: "defense", dueAt: null })).toBeNull();
    expect(
      resolveDeadline({ deadlineType: "defense", dueAt: null, baseDate: "2026-08-22" }),
    ).toBeNull();
  });
});

describe("deadlineStatusFor", () => {
  const now = new Date("2026-08-25T00:00:00Z");

  it("is overdue when due date already passed", () => {
    expect(deadlineStatusFor("2026-08-20T00:00:00Z", now, 3)).toBe("overdue");
  });

  it("is due_soon within the configured window", () => {
    expect(deadlineStatusFor("2026-08-26T00:00:00Z", now, 3)).toBe("due_soon");
  });

  it("is open when well beyond the due_soon window", () => {
    expect(deadlineStatusFor("2026-09-25T00:00:00Z", now, 3)).toBe("open");
  });
});
