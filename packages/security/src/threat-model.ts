import type { ThreatFinding, SecurityLevel, ThreatCategory } from "./types.js";

const CATEGORY_BASE_SCORE: Record<ThreatCategory, number> = {
  injection: 9,
  auth: 8,
  exposure: 7,
  xxe: 6,
  access_control: 8,
  misconfiguration: 5,
  xss: 7,
  deserialization: 8,
  components: 6,
  logging: 4,
};

export function classifyThreat(category: ThreatCategory, mitigated: boolean): SecurityLevel {
  const score = CATEGORY_BASE_SCORE[category];
  const effective = mitigated ? score * 0.2 : score;
  if (effective >= 8) return "critical";
  if (effective >= 6) return "high";
  if (effective >= 3) return "medium";
  return "low";
}

export function computeRiskScore(findings: ThreatFinding[]): number {
  const weights: Record<SecurityLevel, number> = { critical: 10, high: 7, medium: 4, low: 1 };
  return findings.filter((f) => !f.mitigated).reduce((sum, f) => sum + weights[f.level], 0);
}

export function generateMitigations(category: ThreatCategory): string[] {
  const mitigations: Record<ThreatCategory, string[]> = {
    injection: ["Use parameterized queries", "Input validation", "Least privilege DB user"],
    auth: ["MFA enforcement", "Short-lived tokens", "Secure token storage"],
    exposure: ["Encrypt at rest", "Encrypt in transit", "Minimize data exposure"],
    xxe: ["Disable external entities", "Use safe XML parser"],
    access_control: ["RBAC enforcement", "Deny by default", "Log access denials"],
    misconfiguration: ["Security headers", "Disable debug mode", "Regular config audits"],
    xss: ["Output encoding", "CSP headers", "Input sanitization"],
    deserialization: ["Validate serialized data", "Use safe deserialization", "Integrity checks"],
    components: ["Dependency audits", "Update dependencies", "SCA scanning"],
    logging: ["Centralize logs", "Alert on anomalies", "Protect log integrity"],
  };
  return mitigations[category];
}

export function isCritical(finding: ThreatFinding): boolean {
  return finding.level === "critical" && !finding.mitigated;
}

export function countByLevel(findings: ThreatFinding[]): Record<SecurityLevel, number> {
  const counts: Record<SecurityLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.level]++;
  return counts;
}

export function hasOpenCriticals(findings: ThreatFinding[]): boolean {
  return findings.some(isCritical);
}
