import type { CommissionPlan, CommissionRule, CommissionTier, Currency } from "./types.js";

export interface CalculationContext {
  branchId: string;
  grossRevenue: number;
  operationCount: number;
  resourceType?: string;
  date: string;
}

export interface CalculationResult {
  commissionRate: number;
  commissionAmount: number;
  bonusAmount: number;
  totalAmount: number;
  appliedRules: string[];
  currency: Currency;
}

export class CommissionCalculator {
  calculate(
    plan: CommissionPlan,
    rules: CommissionRule[],
    context: CalculationContext,
  ): CalculationResult {
    const baseAmount = this.calculateBase(plan, context.grossRevenue);
    const appliedRules: string[] = [];
    let rateOverride: number | null = null;
    let bonusAmount = 0;

    const sortedRules = [...rules]
      .filter((r) => r.isActive)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (!this.evaluateCondition(rule, context)) continue;

      appliedRules.push(rule.id);

      if (rule.rateOverride !== null) {
        rateOverride = rule.rateOverride;
      }
      if (rule.bonusAmount !== null) {
        bonusAmount += rule.bonusAmount;
      }
    }

    const effectiveRate = rateOverride ?? plan.baseRate;
    const commissionAmount =
      rateOverride !== null ? context.grossRevenue * effectiveRate : baseAmount;

    const totalAmount = commissionAmount + bonusAmount;

    return {
      commissionRate: effectiveRate,
      commissionAmount,
      bonusAmount,
      totalAmount,
      appliedRules,
      currency: plan.currency,
    };
  }

  private calculateBase(plan: CommissionPlan, grossRevenue: number): number {
    if (plan.calculationType === "flat") {
      return plan.baseRate;
    }

    if (plan.calculationType === "percentage") {
      return grossRevenue * plan.baseRate;
    }

    // tiered
    return this.calculateTiered(plan.tiers, grossRevenue);
  }

  private calculateTiered(tiers: CommissionTier[], grossRevenue: number): number {
    if (tiers.length === 0) return 0;

    let total = 0;
    let remaining = grossRevenue;

    for (const tier of tiers) {
      if (remaining <= 0) break;
      if (grossRevenue < tier.minAmount) break;

      const tierMax = tier.maxAmount ?? Infinity;
      const tierMin = tier.minAmount;
      const applicable = Math.min(remaining, tierMax - tierMin);

      if (applicable <= 0) continue;

      total += applicable * tier.rate;
      remaining -= applicable;
    }

    return total;
  }

  private evaluateCondition(rule: CommissionRule, context: CalculationContext): boolean {
    switch (rule.conditionType) {
      case "always":
        return true;
      case "revenue_threshold": {
        const threshold = rule.conditionValue as number;
        return context.grossRevenue >= threshold;
      }
      case "operation_count": {
        const minCount = rule.conditionValue as number;
        return context.operationCount >= minCount;
      }
      case "resource_type": {
        const requiredType = rule.conditionValue as string;
        return context.resourceType === requiredType;
      }
      case "branch": {
        const branchId = rule.conditionValue as string;
        return context.branchId === branchId;
      }
      default:
        return false;
    }
  }
}
