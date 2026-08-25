import { describe, it, expect } from "vitest";
import {
  resolveInspectionVisibility,
  isInspectionVisible,
} from "../../lib/mobile-inspections-scope";
import type { MobileContext } from "../../lib/mobile-context";

// P1.4 — permanent isolation tests for the Inspection Engine mobile
// routes (item 23/24 of the production-completion spec), replacing the
// one-off script previously used to prove the same guarantee. Every
// assertion here mirrors a real attack the spec calls out explicitly:
// Operator A reading Operator B's inspection, Customer A reading
// Customer B's, and a tenant_user boundary staying tenant-scoped.

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

const customerA: MobileContext = {
  userType: "customer",
  userId: "u4",
  email: null,
  customerId: "cust-A",
  organizations: [],
  db: {} as never,
};

const customerB: MobileContext = {
  userType: "customer",
  userId: "u5",
  email: null,
  customerId: "cust-B",
  organizations: [],
  db: {} as never,
};

const unprovisioned: MobileContext = { userType: "unprovisioned", userId: "u6", email: null };

describe("resolveInspectionVisibility", () => {
  it("tenant_user gets a tenant-wide descriptor", () => {
    expect(resolveInspectionVisibility(tenantUser)).toEqual({
      kind: "tenant",
      tenantId: "tenant-1",
    });
  });

  it("operator gets an operator-scoped descriptor, not tenant-wide", () => {
    expect(resolveInspectionVisibility(operatorA)).toEqual({
      kind: "operator",
      tenantId: "tenant-1",
      operatorId: "op-A",
    });
  });

  it("customer gets a customer-scoped descriptor", () => {
    expect(resolveInspectionVisibility(customerA)).toEqual({
      kind: "customer",
      customerId: "cust-A",
    });
  });

  it("unprovisioned resolves to null — no inspection visible at all", () => {
    expect(resolveInspectionVisibility(unprovisioned)).toBeNull();
  });
});

describe("isInspectionVisible — cross-actor isolation", () => {
  const inspectionA = { tenant_id: "tenant-1", operator_id: "op-A", customer_id: "cust-A" };
  const inspectionB = { tenant_id: "tenant-1", operator_id: "op-B", customer_id: "cust-B" };
  const inspectionOtherTenant = { tenant_id: "tenant-2", operator_id: null, customer_id: null };

  it("Operator A can see their own inspection", () => {
    expect(isInspectionVisible(inspectionA, resolveInspectionVisibility(operatorA))).toBe(true);
  });

  it("Operator A CANNOT see Operator B's inspection", () => {
    expect(isInspectionVisible(inspectionB, resolveInspectionVisibility(operatorA))).toBe(false);
  });

  it("Operator B CANNOT see Operator A's inspection (symmetric check)", () => {
    expect(isInspectionVisible(inspectionA, resolveInspectionVisibility(operatorB))).toBe(false);
  });

  it("Customer A can see their own inspection", () => {
    expect(isInspectionVisible(inspectionA, resolveInspectionVisibility(customerA))).toBe(true);
  });

  it("Customer A CANNOT see Customer B's inspection", () => {
    expect(isInspectionVisible(inspectionB, resolveInspectionVisibility(customerA))).toBe(false);
  });

  it("Customer B CANNOT see Customer A's inspection (symmetric check)", () => {
    expect(isInspectionVisible(inspectionA, resolveInspectionVisibility(customerB))).toBe(false);
  });

  it("tenant_user sees any inspection in their own tenant", () => {
    expect(isInspectionVisible(inspectionA, resolveInspectionVisibility(tenantUser))).toBe(true);
    expect(isInspectionVisible(inspectionB, resolveInspectionVisibility(tenantUser))).toBe(true);
  });

  it("tenant_user CANNOT see an inspection belonging to a different tenant", () => {
    expect(
      isInspectionVisible(inspectionOtherTenant, resolveInspectionVisibility(tenantUser)),
    ).toBe(false);
  });

  it("an operator in tenant-1 CANNOT see an inspection in tenant-2 even with a matching operator_id coincidence", () => {
    const crossTenantRow = { tenant_id: "tenant-2", operator_id: "op-A", customer_id: null };
    expect(isInspectionVisible(crossTenantRow, resolveInspectionVisibility(operatorA))).toBe(false);
  });

  it("unprovisioned sees nothing, regardless of row content", () => {
    expect(isInspectionVisible(inspectionA, resolveInspectionVisibility(unprovisioned))).toBe(
      false,
    );
  });
});
