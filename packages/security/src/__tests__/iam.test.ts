import { describe, it, expect } from "vitest";
import {
  validateJwtStructure,
  isTokenExpired,
  checkPermission,
  computeEffectivePermissions,
  validateDelegation,
  validateImpersonation,
} from "../iam.js";
import type { JwtClaims, Permission } from "../types.js";

function makeClaims(overrides: Partial<JwtClaims> = {}): JwtClaims {
  return {
    sub: "u1",
    tenantId: "t1",
    roles: ["operator"],
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

describe("validateJwtStructure", () => {
  it("returns no violations for valid claims", () => {
    expect(validateJwtStructure(makeClaims())).toHaveLength(0);
  });

  it("reports missing sub", () => {
    const v = validateJwtStructure({ tenantId: "t1", roles: ["op"], exp: 999, iat: 0 });
    expect(v.some((x) => x.rule === "JWT_SUB_REQUIRED")).toBe(true);
  });

  it("reports missing tenantId", () => {
    const v = validateJwtStructure({ sub: "u1", roles: ["op"], exp: 999, iat: 0 });
    expect(v.some((x) => x.rule === "JWT_TENANT_REQUIRED")).toBe(true);
  });

  it("reports missing roles", () => {
    const v = validateJwtStructure({ sub: "u1", tenantId: "t1", roles: [], exp: 999, iat: 0 });
    expect(v.some((x) => x.rule === "JWT_ROLES_REQUIRED")).toBe(true);
  });

  it("reports missing exp", () => {
    const v = validateJwtStructure({ sub: "u1", tenantId: "t1", roles: ["op"] });
    expect(v.some((x) => x.rule === "JWT_EXP_REQUIRED")).toBe(true);
  });

  it("accumulates multiple violations", () => {
    expect(validateJwtStructure({})).toHaveLength(4);
  });
});

describe("isTokenExpired", () => {
  it("returns false for future expiry", () => {
    expect(isTokenExpired(makeClaims())).toBe(false);
  });

  it("returns true for past expiry", () => {
    expect(isTokenExpired(makeClaims({ exp: 1 }))).toBe(true);
  });
});

describe("checkPermission", () => {
  const granted: Permission[] = [
    { resource: "contracts", action: "read" },
    { resource: "assets", action: "*" },
  ];

  it("returns true for matching resource and action", () => {
    expect(checkPermission(makeClaims(), { resource: "contracts", action: "read" }, granted)).toBe(
      true,
    );
  });

  it("returns true for wildcard action", () => {
    expect(checkPermission(makeClaims(), { resource: "assets", action: "delete" }, granted)).toBe(
      true,
    );
  });

  it("returns false when no match", () => {
    expect(checkPermission(makeClaims(), { resource: "billing", action: "write" }, granted)).toBe(
      false,
    );
  });
});

describe("computeEffectivePermissions", () => {
  it("merges permissions from multiple roles", () => {
    const map = {
      admin: [{ resource: "users", action: "write" }],
      operator: [{ resource: "contracts", action: "read" }],
    };
    const perms = computeEffectivePermissions(map, ["admin", "operator"]);
    expect(perms).toHaveLength(2);
  });

  it("deduplicates permissions", () => {
    const map = {
      r1: [{ resource: "contracts", action: "read" }],
      r2: [{ resource: "contracts", action: "read" }],
    };
    expect(computeEffectivePermissions(map, ["r1", "r2"])).toHaveLength(1);
  });

  it("returns empty for unknown roles", () => {
    expect(computeEffectivePermissions({}, ["unknown"])).toHaveLength(0);
  });
});

describe("validateDelegation", () => {
  it("returns no violations for direct claims", () => {
    expect(validateDelegation(makeClaims())).toHaveLength(0);
  });

  it("returns no violations for valid delegation within depth", () => {
    expect(validateDelegation(makeClaims({ delegatedBy: "admin" }), 1)).toHaveLength(0);
  });

  it("returns violation when delegation depth exceeded", () => {
    const v = validateDelegation(makeClaims({ delegatedBy: "admin" }), 0);
    expect(v.some((x) => x.rule === "DELEGATION_DEPTH_EXCEEDED")).toBe(true);
  });
});

describe("validateImpersonation", () => {
  it("returns true for platform_admin impersonating different tenant", () => {
    const claims = makeClaims({ roles: ["platform_admin"], tenantId: "platform" });
    expect(validateImpersonation(claims, "t1")).toBe(true);
  });

  it("returns false for non-admin", () => {
    expect(validateImpersonation(makeClaims({ roles: ["operator"] }), "t2")).toBe(false);
  });

  it("returns false when same tenant", () => {
    const claims = makeClaims({ roles: ["platform_admin"], tenantId: "t1" });
    expect(validateImpersonation(claims, "t1")).toBe(false);
  });
});
