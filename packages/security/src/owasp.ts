import type { SecurityViolation } from "./types.js";

const SQL_PATTERNS = [
  /'\s*(or|and)\s*'?\d/i,
  /;\s*(drop|delete|insert|update)\s/i,
  /union\s+select/i,
  /--/,
  /\/\*/,
];
const XSS_PATTERNS = [/<script/i, /javascript:/i, /on\w+\s*=/i, /<iframe/i];

export function detectSQLInjection(input: string): boolean {
  return SQL_PATTERNS.some((p) => p.test(input));
}

export function detectXSS(input: string): boolean {
  return XSS_PATTERNS.some((p) => p.test(input));
}

export function validateInputSanitization(inputs: Record<string, string>): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  for (const [field, value] of Object.entries(inputs)) {
    if (detectSQLInjection(value)) {
      violations.push({
        rule: "SQL_INJECTION_DETECTED",
        severity: "critical",
        detail: `Field '${field}' contains potential SQL injection`,
      });
    }
    if (detectXSS(value)) {
      violations.push({
        rule: "XSS_DETECTED",
        severity: "high",
        detail: `Field '${field}' contains potential XSS payload`,
      });
    }
  }
  return violations;
}

export function validateCSRF(requestToken: string | undefined, sessionToken: string): boolean {
  if (!requestToken) return false;
  return requestToken === sessionToken;
}

export function validateRateLimit(requests: number, limitPerWindow: number): SecurityViolation[] {
  if (requests > limitPerWindow) {
    return [
      {
        rule: "RATE_LIMIT_EXCEEDED",
        severity: "medium",
        detail: `${requests} requests exceed limit of ${limitPerWindow}`,
      },
    ];
  }
  return [];
}

export function computeOwaspRiskScore(violations: SecurityViolation[]): number {
  const severityScores = { critical: 10, high: 7, medium: 4, low: 1 };
  return violations.reduce((sum, v) => sum + severityScores[v.severity], 0);
}

export function hasCriticalViolations(violations: SecurityViolation[]): boolean {
  return violations.some((v) => v.severity === "critical");
}
