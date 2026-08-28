import { describe, it, expect } from "vitest";
import {
  resolveInfractionVisibility,
  isInfractionVisible,
} from "../../lib/mobile-infractions-scope";
import type { MobileContext } from "../../lib/mobile-context";

// Mobile screens phase (docs/architecture/INFRACTIONS_ENGINE.md) —
// permanent isolation tests for /api/mobile/operator-infractions,
// following the exact mobile-inspections-scope.test.ts pattern (P1.4):
// operator A/B cross-read denial in both directions, tenant boundary,
// unprovisioned denial.

const tenantUser: MobileContext = {
  userType: "tenant_user",
  userId: "u1",
  email: null,
  tenantId: "tenant-1",
  tenantRole: "tenant_admin",
  isImpersonating: false,
  accessMode: "full",
  db: {} as never,
};

const operatorA: MobileContext = {
  userType: "operator",
  userId: "u2",
  email: null,
  operatorId: "op-A",
  tenantId: "tenant-1",
  db: {} as never,
};

const operatorB: MobileContext = {
  userType: "operator",
  userId: "u3",
  email: null,
  operatorId: "op-B",
  tenantId: "tenant-1",
  db: {} as never,
};

const customer: MobileContext = {
  userType: "customer",
  userId: "u4",
  email: null,
  customerId: "cust-A",
  organizations: [],
  db: {} as never,
};

const unprovisioned: MobileContext = { userType: "unprovisioned", userId: "u6", email: null };

describe("resolveInfractionVisibility", () => {
  it("tenant_user gets a tenant-wide descriptor", () => {
    expect(resolveInfractionVisibility(tenantUser)).toEqual({
      kind: "tenant",
      tenantId: "tenant-1",
    });
  });

  it("operator gets an operator-scoped descriptor, not tenant-wide", () => {
    expect(resolveInfractionVisibility(operatorA)).toEqual({
      kind: "operator",
      tenantId: "tenant-1",
      operatorId: "op-A",
    });
  });

  it("customer resolves to null -- no customer-facing infraction route exists yet (documented gap)", () => {
    expect(resolveInfractionVisibility(customer)).toBeNull();
  });

  it("unprovisioned resolves to null", () => {
    expect(resolveInfractionVisibility(unprovisioned)).toBeNull();
  });
});

describe("isInfractionVisible — cross-actor isolation", () => {
  const caseA = { tenant_id: "tenant-1", operator_id: "op-A" };
  const caseB = { tenant_id: "tenant-1", operator_id: "op-B" };
  const caseNoOperator = { tenant_id: "tenant-1", operator_id: null };
  const caseOtherTenant = { tenant_id: "tenant-2", operator_id: null };

  it("Operator A can see their own case", () => {
    expect(isInfractionVisible(caseA, resolveInfractionVisibility(operatorA))).toBe(true);
  });

  it("Operator A CANNOT see Operator B's case", () => {
    expect(isInfractionVisible(caseB, resolveInfractionVisibility(operatorA))).toBe(false);
  });

  it("Operator B CANNOT see Operator A's case (symmetric check)", () => {
    expect(isInfractionVisible(caseA, resolveInfractionVisibility(operatorB))).toBe(false);
  });

  it("an operator never sees a case with no operator_id set", () => {
    expect(isInfractionVisible(caseNoOperator, resolveInfractionVisibility(operatorA))).toBe(false);
  });

  it("tenant_user sees any case in their own tenant, including ones with no operator", () => {
    expect(isInfractionVisible(caseA, resolveInfractionVisibility(tenantUser))).toBe(true);
    expect(isInfractionVisible(caseNoOperator, resolveInfractionVisibility(tenantUser))).toBe(true);
  });

  it("tenant_user CANNOT see a case belonging to a different tenant", () => {
    expect(isInfractionVisible(caseOtherTenant, resolveInfractionVisibility(tenantUser))).toBe(
      false,
    );
  });

  it("an operator in tenant-1 CANNOT see a case in tenant-2 even with a matching operator_id coincidence", () => {
    const crossTenantRow = { tenant_id: "tenant-2", operator_id: "op-A" };
    expect(isInfractionVisible(crossTenantRow, resolveInfractionVisibility(operatorA))).toBe(false);
  });

  it("unprovisioned sees nothing, regardless of row content", () => {
    expect(isInfractionVisible(caseA, resolveInfractionVisibility(unprovisioned))).toBe(false);
  });
});
