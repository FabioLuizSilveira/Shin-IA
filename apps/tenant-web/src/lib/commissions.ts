import type { Commission, CommissionStatus } from "./types.js";

export function aggregateByPeriod(commissions: Commission[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const c of commissions) {
    result[c.period] = (result[c.period] ?? 0) + c.amount;
  }
  return result;
}

export function filterByStatus(commissions: Commission[], status: CommissionStatus): Commission[] {
  return commissions.filter((c) => c.status === status);
}

export function computeTotalCommissions(commissions: Commission[]): number {
  return commissions.reduce((sum, c) => sum + c.amount, 0);
}

export function groupByAgent(commissions: Commission[]): Record<string, Commission[]> {
  const result: Record<string, Commission[]> = {};
  for (const c of commissions) {
    const existing = result[c.agentName];
    if (existing) {
      existing.push(c);
    } else {
      result[c.agentName] = [c];
    }
  }
  return result;
}
