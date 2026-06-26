import { describe, it, expect } from "vitest";
import {
  classifyThreat,
  computeRiskScore,
  generateMitigations,
  isCritical,
  countByLevel,
  hasOpenCriticals,
} from "../threat-model.js";
import type { ThreatFinding } from "../types.js";

function makeFinding(overrides: Partial<ThreatFinding> = {}): ThreatFinding {
  return {
    id: "f1",
    category: "injection",
    level: "critical",
    description: "SQL injection possible",
    mitigated: false,
    ...overrides,
  };
}

describe("classifyThreat", () => {
  it("classifies injection as critical when not mitigated", () => {
    expect(classifyThreat("injection", false)).toBe("critical");
  });

  it("reduces severity when mitigated", () => {
    const mitigated = classifyThreat("injection", true);
    expect(["low", "medium"]).toContain(mitigated);
  });

  it("classifies logging as lower severity", () => {
    const level = classifyThreat("logging", false);
    expect(["low", "medium"]).toContain(level);
  });

  it("classifies auth as critical", () => {
    expect(classifyThreat("auth", false)).toBe("critical");
  });

  it("classifies xss as high", () => {
    expect(classifyThreat("xss", false)).toBe("high");
  });
});

describe("computeRiskScore", () => {
  it("returns 0 for no findings", () => {
    expect(computeRiskScore([])).toBe(0);
  });

  it("skips mitigated findings", () => {
    expect(computeRiskScore([makeFinding({ mitigated: true })])).toBe(0);
  });

  it("sums non-mitigated findings", () => {
    const findings = [makeFinding({ level: "critical" }), makeFinding({ id: "f2", level: "low" })];
    expect(computeRiskScore(findings)).toBe(11);
  });
});

describe("generateMitigations", () => {
  it("returns mitigations for injection", () => {
    const m = generateMitigations("injection");
    expect(m.length).toBeGreaterThan(0);
    expect(m.some((s) => s.toLowerCase().includes("param"))).toBe(true);
  });

  it("returns mitigations for all categories", () => {
    const categories = [
      "auth",
      "exposure",
      "xxe",
      "access_control",
      "misconfiguration",
      "xss",
      "deserialization",
      "components",
      "logging",
    ] as const;
    for (const cat of categories) {
      expect(generateMitigations(cat).length).toBeGreaterThan(0);
    }
  });
});

describe("isCritical", () => {
  it("returns true for critical unmitigated finding", () => {
    expect(isCritical(makeFinding())).toBe(true);
  });

  it("returns false for mitigated finding", () => {
    expect(isCritical(makeFinding({ mitigated: true }))).toBe(false);
  });

  it("returns false for non-critical finding", () => {
    expect(isCritical(makeFinding({ level: "high" }))).toBe(false);
  });
});

describe("countByLevel", () => {
  it("returns zeros for empty", () => {
    const counts = countByLevel([]);
    expect(counts.critical).toBe(0);
    expect(counts.high).toBe(0);
  });

  it("counts correctly", () => {
    const findings = [
      makeFinding({ level: "critical" }),
      makeFinding({ id: "f2", level: "high" }),
      makeFinding({ id: "f3", level: "high" }),
    ];
    const counts = countByLevel(findings);
    expect(counts.critical).toBe(1);
    expect(counts.high).toBe(2);
  });
});

describe("hasOpenCriticals", () => {
  it("returns false for no findings", () => {
    expect(hasOpenCriticals([])).toBe(false);
  });

  it("returns true for open critical", () => {
    expect(hasOpenCriticals([makeFinding()])).toBe(true);
  });

  it("returns false when all criticals are mitigated", () => {
    expect(hasOpenCriticals([makeFinding({ mitigated: true })])).toBe(false);
  });
});
