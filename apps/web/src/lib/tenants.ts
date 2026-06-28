import type { Tenant, TenantInput, TenantMetrics, TenantStatus } from "./types.js";

export function validateTenantInput(input: TenantInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("name is required");
  if (!input.email.includes("@")) errors.push("email is invalid");
  if (!input.plan.trim()) errors.push("plan is required");
  if (!input.country.trim()) errors.push("country is required");
  return { valid: errors.length === 0, errors };
}

export function formatTenantStatus(status: TenantStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "trial":
      return "Trial";
    case "churned":
      return "Churned";
    default:
      return "Unknown";
  }
}

export function computeAggregatedMetrics(tenants: Tenant[]): TenantMetrics {
  return tenants.reduce(
    (acc, t) => ({
      totalUsers: acc.totalUsers + t.metrics.totalUsers,
      activeDevices: acc.activeDevices + t.metrics.activeDevices,
      monthlyRevenue: acc.monthlyRevenue + t.metrics.monthlyRevenue,
      storageUsedGb: acc.storageUsedGb + t.metrics.storageUsedGb,
    }),
    { totalUsers: 0, activeDevices: 0, monthlyRevenue: 0, storageUsedGb: 0 },
  );
}

export function filterTenantsByStatus(tenants: Tenant[], status: TenantStatus): Tenant[] {
  return tenants.filter((t) => t.status === status);
}

export function sortTenantsByRevenue(tenants: Tenant[]): Tenant[] {
  return [...tenants].sort((a, b) => b.metrics.monthlyRevenue - a.metrics.monthlyRevenue);
}
