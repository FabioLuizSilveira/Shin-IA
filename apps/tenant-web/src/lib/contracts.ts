import type { Contract, ContractStatus } from "./types.js";

export function isExpired(contract: Contract): boolean {
  return new Date(contract.endDate) < new Date();
}

export function computeRemainingDays(contract: Contract): number {
  const diff = new Date(contract.endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function computeTotalContractValue(contracts: Contract[]): number {
  return contracts.reduce((sum, c) => sum + c.totalValue, 0);
}

export function filterByStatus(contracts: Contract[], status: ContractStatus): Contract[] {
  return contracts.filter((c) => c.status === status);
}

export function sortByEndDate(contracts: Contract[]): Contract[] {
  return [...contracts].sort(
    (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime(),
  );
}
