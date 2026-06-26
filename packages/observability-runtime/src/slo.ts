import type { SLODefinition, SLOStatus } from "./types.js";

export function computeAvailability(totalRequests: number, failedRequests: number): number {
  if (totalRequests === 0) return 100;
  return ((totalRequests - failedRequests) / totalRequests) * 100;
}

export function computeErrorBudget(slo: SLODefinition, currentPercent: number): number {
  const allowedErrorRate = 100 - slo.targetPercent;
  const actualErrorRate = 100 - currentPercent;
  const consumed = actualErrorRate / allowedErrorRate;
  return Math.max(0, (1 - consumed) * 100);
}

export function computeBurnRate(
  errorBudgetConsumedPercent: number,
  windowFraction: number,
): number {
  if (windowFraction === 0) return 0;
  return errorBudgetConsumedPercent / windowFraction;
}

export function isBreaching(slo: SLODefinition, currentPercent: number): boolean {
  return currentPercent < slo.targetPercent;
}

export function computeSLOStatus(slo: SLODefinition, currentPercent: number): SLOStatus {
  return {
    slo,
    currentPercent,
    errorBudgetRemaining: computeErrorBudget(slo, currentPercent),
    isBreaching: isBreaching(slo, currentPercent),
  };
}

export function formatSLOReport(status: SLOStatus): string {
  const state = status.isBreaching ? "BREACHING" : "OK";
  return `[${state}] ${status.slo.name}: ${status.currentPercent.toFixed(2)}% (target: ${status.slo.targetPercent}%) — budget remaining: ${status.errorBudgetRemaining.toFixed(1)}%`;
}
