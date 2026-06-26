import { describe, it, expect } from "vitest";
import {
  detectSQLInjection,
  detectXSS,
  validateInputSanitization,
  validateCSRF,
  validateRateLimit,
  computeOwaspRiskScore,
  hasCriticalViolations,
} from "../owasp.js";
import type { SecurityViolation } from "../types.js";

describe("detectSQLInjection", () => {
  it("detects OR-based injection", () => {
    expect(detectSQLInjection("' OR '1'='1")).toBe(true);
  });

  it("detects UNION SELECT", () => {
    expect(detectSQLInjection("foo UNION SELECT * FROM users")).toBe(true);
  });

  it("detects DROP statement", () => {
    expect(detectSQLInjection("; DROP TABLE users")).toBe(true);
  });

  it("detects SQL comment", () => {
    expect(detectSQLInjection("admin' --")).toBe(true);
  });

  it("returns false for clean input", () => {
    expect(detectSQLInjection("Acme Rentals Ltda")).toBe(false);
  });
});

describe("detectXSS", () => {
  it("detects script tag", () => {
    expect(detectXSS("<script>alert(1)</script>")).toBe(true);
  });

  it("detects javascript protocol", () => {
    expect(detectXSS("javascript:alert(1)")).toBe(true);
  });

  it("detects inline event", () => {
    expect(detectXSS("<img onerror=alert(1)>")).toBe(true);
  });

  it("detects iframe", () => {
    expect(detectXSS("<iframe src=x>")).toBe(true);
  });

  it("returns false for clean input", () => {
    expect(detectXSS("Hello World")).toBe(false);
  });
});

describe("validateInputSanitization", () => {
  it("returns no violations for clean inputs", () => {
    expect(validateInputSanitization({ name: "Acme", email: "a@b.com" })).toHaveLength(0);
  });

  it("reports SQL injection", () => {
    const v = validateInputSanitization({ q: "' OR '1'='1" });
    expect(v.some((x) => x.rule === "SQL_INJECTION_DETECTED")).toBe(true);
  });

  it("reports XSS", () => {
    const v = validateInputSanitization({ bio: "<script>evil()</script>" });
    expect(v.some((x) => x.rule === "XSS_DETECTED")).toBe(true);
  });

  it("reports both for combined payload", () => {
    const v = validateInputSanitization({ q: "' OR '1'='1", bio: "<script>x</script>" });
    expect(v.length).toBeGreaterThanOrEqual(2);
  });
});

describe("validateCSRF", () => {
  it("returns true when tokens match", () => {
    expect(validateCSRF("tok123", "tok123")).toBe(true);
  });

  it("returns false when tokens differ", () => {
    expect(validateCSRF("tok123", "tok456")).toBe(false);
  });

  it("returns false when request token is undefined", () => {
    expect(validateCSRF(undefined, "tok123")).toBe(false);
  });
});

describe("validateRateLimit", () => {
  it("returns no violations under limit", () => {
    expect(validateRateLimit(50, 100)).toHaveLength(0);
  });

  it("returns violation when limit exceeded", () => {
    const v = validateRateLimit(101, 100);
    expect(v.some((x) => x.rule === "RATE_LIMIT_EXCEEDED")).toBe(true);
  });

  it("returns no violations at exactly the limit", () => {
    expect(validateRateLimit(100, 100)).toHaveLength(0);
  });
});

describe("computeOwaspRiskScore", () => {
  it("returns 0 for no violations", () => {
    expect(computeOwaspRiskScore([])).toBe(0);
  });

  it("sums severity scores", () => {
    const violations: SecurityViolation[] = [
      { rule: "A", severity: "critical", detail: "" },
      { rule: "B", severity: "low", detail: "" },
    ];
    expect(computeOwaspRiskScore(violations)).toBe(11);
  });
});

describe("hasCriticalViolations", () => {
  it("returns false for no violations", () => {
    expect(hasCriticalViolations([])).toBe(false);
  });

  it("returns true when critical exists", () => {
    const violations: SecurityViolation[] = [{ rule: "A", severity: "critical", detail: "" }];
    expect(hasCriticalViolations(violations)).toBe(true);
  });

  it("returns false for only medium/low/high", () => {
    const violations: SecurityViolation[] = [
      { rule: "A", severity: "high", detail: "" },
      { rule: "B", severity: "medium", detail: "" },
    ];
    expect(hasCriticalViolations(violations)).toBe(false);
  });
});
