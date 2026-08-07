import { describe, it, expect } from "vitest";
import { sanitizePostgrestFilterValue } from "./postgrest-filter";

describe("sanitizePostgrestFilterValue", () => {
  it("leaves normal search text untouched", () => {
    expect(sanitizePostgrestFilterValue("summer sale campaign")).toBe("summer sale campaign");
  });

  it("strips commas, parentheses and periods used to inject extra filter conditions", () => {
    expect(sanitizePostgrestFilterValue("x,status.eq.approved")).toBe("xstatuseqapproved");
    expect(sanitizePostgrestFilterValue("a)or(b.eq.1")).toBe("aorbeq1");
  });

  it("removes every occurrence of each metacharacter, not just the first", () => {
    expect(sanitizePostgrestFilterValue("a,b,c(d)e.f")).toBe("abcdef");
  });
});
