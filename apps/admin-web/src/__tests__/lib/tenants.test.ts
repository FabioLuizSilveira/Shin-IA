import { describe, it, expect } from "vitest";
import {
  validateTenantInput,
  formatTenantStatus,
  computeAggregatedMetrics,
  filterTenantsByStatus,
  sortTenantsByRevenue,
} from "../../lib/tenants.js";
import type { Tenant } from "../../lib/types.js";

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: "t1",
    name: "Acme Rentals",
    email: "acme@example.com",
    plan: "pro",
    status: "active",
    metrics: { totalUsers: 5, activeDevices: 10, monthlyRevenue: 1000, storageUsedGb: 2 },
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("validateTenantInput", () => {
  it("returns valid for correct input", () => {
    const result = validateTenantInput({
      name: "Acme",
      email: "a@b.com",
      plan: "pro",
      country: "BR",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing name", () => {
    const result = validateTenantInput({ name: "", email: "a@b.com", plan: "pro", country: "BR" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = validateTenantInput({
      name: "Acme",
      email: "not-an-email",
      plan: "pro",
      country: "BR",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("email"))).toBe(true);
  });

  it("rejects missing plan", () => {
    const result = validateTenantInput({ name: "Acme", email: "a@b.com", plan: "", country: "BR" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("plan"))).toBe(true);
  });

  it("rejects missing country", () => {
    const result = validateTenantInput({
      name: "Acme",
      email: "a@b.com",
      plan: "pro",
      country: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("country"))).toBe(true);
  });

  it("accumulates multiple errors", () => {
    const result = validateTenantInput({ name: "", email: "bad", plan: "", country: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe("formatTenantStatus", () => {
  it("formats active", () => expect(formatTenantStatus("active")).toBe("Active"));
  it("formats suspended", () => expect(formatTenantStatus("suspended")).toBe("Suspended"));
  it("formats trial", () => expect(formatTenantStatus("trial")).toBe("Trial"));
  it("formats churned", () => expect(formatTenantStatus("churned")).toBe("Churned"));
});

describe("computeAggregatedMetrics", () => {
  it("returns zeros for empty array", () => {
    const result = computeAggregatedMetrics([]);
    expect(result.monthlyRevenue).toBe(0);
    expect(result.totalUsers).toBe(0);
  });

  it("sums monthlyRevenue across tenants", () => {
    const tenants = [
      makeTenant({
        metrics: { totalUsers: 2, activeDevices: 4, monthlyRevenue: 500, storageUsedGb: 1 },
      }),
      makeTenant({
        id: "t2",
        metrics: { totalUsers: 3, activeDevices: 6, monthlyRevenue: 300, storageUsedGb: 2 },
      }),
    ];
    const result = computeAggregatedMetrics(tenants);
    expect(result.monthlyRevenue).toBe(800);
  });

  it("sums totalUsers across tenants", () => {
    const tenants = [
      makeTenant({
        metrics: { totalUsers: 3, activeDevices: 5, monthlyRevenue: 100, storageUsedGb: 1 },
      }),
      makeTenant({
        id: "t2",
        metrics: { totalUsers: 7, activeDevices: 10, monthlyRevenue: 200, storageUsedGb: 2 },
      }),
    ];
    const result = computeAggregatedMetrics(tenants);
    expect(result.totalUsers).toBe(10);
  });
});

describe("filterTenantsByStatus", () => {
  it("filters to active only", () => {
    const tenants = [makeTenant({ status: "active" }), makeTenant({ id: "t2", status: "trial" })];
    const result = filterTenantsByStatus(tenants, "active");
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("active");
  });

  it("returns empty when no match", () => {
    const tenants = [makeTenant({ status: "active" })];
    expect(filterTenantsByStatus(tenants, "churned")).toHaveLength(0);
  });
});

describe("sortTenantsByRevenue", () => {
  it("sorts descending by monthlyRevenue", () => {
    const tenants = [
      makeTenant({
        id: "a",
        metrics: { totalUsers: 1, activeDevices: 1, monthlyRevenue: 100, storageUsedGb: 1 },
      }),
      makeTenant({
        id: "b",
        metrics: { totalUsers: 2, activeDevices: 2, monthlyRevenue: 500, storageUsedGb: 2 },
      }),
    ];
    const sorted = sortTenantsByRevenue(tenants);
    expect(sorted[0]?.id).toBe("b");
    expect(sorted[1]?.id).toBe("a");
  });

  it("handles equal revenue without error", () => {
    const tenants = [
      makeTenant({
        id: "x",
        metrics: { totalUsers: 1, activeDevices: 1, monthlyRevenue: 200, storageUsedGb: 1 },
      }),
      makeTenant({
        id: "y",
        metrics: { totalUsers: 2, activeDevices: 2, monthlyRevenue: 200, storageUsedGb: 2 },
      }),
    ];
    expect(() => sortTenantsByRevenue(tenants)).not.toThrow();
  });
});
