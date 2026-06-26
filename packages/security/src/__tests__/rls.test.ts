import { describe, it, expect } from "vitest";
import {
  validateRLSPolicy,
  buildRLSFilter,
  enforceRowSecurity,
  computeTenantScope,
  validateIsolation,
} from "../rls.js";
import type { RLSPolicy } from "../types.js";

function makePolicy(overrides: Partial<RLSPolicy> = {}): RLSPolicy {
  return {
    tenantId: "t1",
    table: "contracts",
    column: "tenant_id",
    value: "t1",
    ...overrides,
  };
}

describe("validateRLSPolicy", () => {
  it("returns no violations for valid policy", () => {
    expect(validateRLSPolicy(makePolicy())).toHaveLength(0);
  });

  it("reports empty tenantId", () => {
    const v = validateRLSPolicy(makePolicy({ tenantId: "" }));
    expect(v.some((x) => x.rule === "RLS_TENANT_EMPTY")).toBe(true);
  });

  it("reports empty table", () => {
    const v = validateRLSPolicy(makePolicy({ table: "" }));
    expect(v.some((x) => x.rule === "RLS_TABLE_EMPTY")).toBe(true);
  });

  it("reports empty column", () => {
    const v = validateRLSPolicy(makePolicy({ column: "" }));
    expect(v.some((x) => x.rule === "RLS_COLUMN_EMPTY")).toBe(true);
  });

  it("reports empty value", () => {
    const v = validateRLSPolicy(makePolicy({ value: "" }));
    expect(v.some((x) => x.rule === "RLS_VALUE_EMPTY")).toBe(true);
  });
});

describe("buildRLSFilter", () => {
  it("builds filter with tenant_id column", () => {
    const filter = buildRLSFilter("t1", "contracts");
    expect(filter.table).toBe("contracts");
    expect(filter.column).toBe("tenant_id");
    expect(filter.value).toBe("t1");
  });
});

describe("enforceRowSecurity", () => {
  it("returns only rows matching tenantId", () => {
    const rows = [
      { tenant_id: "t1", id: "r1" },
      { tenant_id: "t2", id: "r2" },
    ];
    expect(enforceRowSecurity(rows, "t1")).toHaveLength(1);
  });

  it("returns empty when no rows match", () => {
    expect(enforceRowSecurity([{ tenant_id: "t2" }], "t1")).toHaveLength(0);
  });

  it("returns all rows when all match", () => {
    const rows = [{ tenant_id: "t1" }, { tenant_id: "t1" }];
    expect(enforceRowSecurity(rows, "t1")).toHaveLength(2);
  });
});

describe("computeTenantScope", () => {
  it("creates one policy per table", () => {
    const policies = computeTenantScope("t1", ["contracts", "assets", "invoices"]);
    expect(policies).toHaveLength(3);
    expect(policies.every((p) => p.tenantId === "t1")).toBe(true);
  });

  it("returns empty for empty tables", () => {
    expect(computeTenantScope("t1", [])).toHaveLength(0);
  });
});

describe("validateIsolation", () => {
  it("returns isolated for empty rows", () => {
    expect(validateIsolation([], "t1")).toBe("isolated");
  });

  it("returns isolated when all rows match", () => {
    const rows = [{ tenant_id: "t1" }, { tenant_id: "t1" }];
    expect(validateIsolation(rows, "t1")).toBe("isolated");
  });

  it("returns leaked when any row has wrong tenant", () => {
    const rows = [{ tenant_id: "t1" }, { tenant_id: "t2" }];
    expect(validateIsolation(rows, "t1")).toBe("leaked");
  });
});
