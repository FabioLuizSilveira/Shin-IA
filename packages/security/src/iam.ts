import type { JwtClaims, Permission, SecurityViolation } from "./types.js";

export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SecurityError";
  }
}

export function validateJwtStructure(claims: Partial<JwtClaims>): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  if (!claims.sub)
    violations.push({
      rule: "JWT_SUB_REQUIRED",
      severity: "critical",
      detail: "Subject claim missing",
    });
  if (!claims.tenantId)
    violations.push({
      rule: "JWT_TENANT_REQUIRED",
      severity: "critical",
      detail: "TenantId claim missing",
    });
  if (!claims.roles || claims.roles.length === 0)
    violations.push({
      rule: "JWT_ROLES_REQUIRED",
      severity: "high",
      detail: "Roles claim missing or empty",
    });
  if (!claims.exp)
    violations.push({ rule: "JWT_EXP_REQUIRED", severity: "high", detail: "Expiry claim missing" });
  return violations;
}

export function isTokenExpired(claims: JwtClaims): boolean {
  return Date.now() / 1000 > claims.exp;
}

export function checkPermission(
  _claims: JwtClaims,
  required: Permission,
  granted: Permission[],
): boolean {
  return granted.some(
    (p) =>
      (p.resource === required.resource || p.resource === "*") &&
      (p.action === required.action || p.action === "*"),
  );
}

export function computeEffectivePermissions(
  rolePermissions: Record<string, Permission[]>,
  roles: string[],
): Permission[] {
  const seen = new Set<string>();
  const result: Permission[] = [];
  for (const role of roles) {
    const perms = rolePermissions[role] ?? [];
    for (const p of perms) {
      const key = `${p.resource}:${p.action}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }
  }
  return result;
}

export function validateDelegation(claims: JwtClaims, maxDepth = 1): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  if (claims.delegatedBy) {
    if (maxDepth < 1) {
      violations.push({
        rule: "DELEGATION_DEPTH_EXCEEDED",
        severity: "high",
        detail: `Delegation depth exceeds maximum of ${maxDepth}`,
      });
    }
  }
  return violations;
}

export function validateImpersonation(actorClaims: JwtClaims, targetTenantId: string): boolean {
  return actorClaims.roles.includes("platform_admin") && actorClaims.tenantId !== targetTenantId;
}
