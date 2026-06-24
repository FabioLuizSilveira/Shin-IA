// ─── Commission Plan ──────────────────────────────────────────────────────────

export type CommissionPlanStatus = "active" | "inactive" | "archived";
export type CommissionCalculationType = "flat" | "percentage" | "tiered";
export type CommissionPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "annual";
export type Currency = "BRL" | "USD" | "EUR";

export interface CommissionTier {
  minAmount: number;
  maxAmount: number | null;
  rate: number;
}

export interface CommissionPlan {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  calculationType: CommissionCalculationType;
  baseRate: number;
  tiers: CommissionTier[];
  currency: Currency;
  period: CommissionPeriod;
  status: CommissionPlanStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Commission Rule ──────────────────────────────────────────────────────────

export type CommissionRuleConditionType =
  | "revenue_threshold"
  | "operation_count"
  | "resource_type"
  | "branch"
  | "always";

export interface CommissionRule {
  id: string;
  planId: string;
  tenantId: string;
  name: string;
  priority: number;
  conditionType: CommissionRuleConditionType;
  conditionValue: unknown;
  rateOverride: number | null;
  bonusAmount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Commission Campaign ──────────────────────────────────────────────────────

export type CommissionCampaignStatus = "draft" | "active" | "paused" | "completed" | "cancelled";

export interface CommissionCampaign {
  id: string;
  tenantId: string;
  planId: string;
  name: string;
  description: string;
  status: CommissionCampaignStatus;
  startDate: string;
  endDate: string;
  bonusRate: number;
  maxPayout: number | null;
  eligibleBranchIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Commission Target ────────────────────────────────────────────────────────

export type CommissionTargetStatus = "pending" | "achieved" | "missed" | "partial";

export interface CommissionTarget {
  id: string;
  tenantId: string;
  planId: string;
  branchId: string;
  period: CommissionPeriod;
  periodStart: string;
  periodEnd: string;
  targetRevenue: number;
  targetOperations: number | null;
  achievedRevenue: number;
  achievedOperations: number;
  status: CommissionTargetStatus;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

// ─── Commission Transaction ───────────────────────────────────────────────────

export type CommissionTransactionStatus = "pending" | "approved" | "rejected" | "paid";
export type CommissionTransactionType = "earned" | "bonus" | "adjustment" | "reversal";

export interface CommissionTransaction {
  id: string;
  tenantId: string;
  branchId: string;
  planId: string;
  campaignId: string | null;
  targetId: string | null;
  operationId: string | null;
  type: CommissionTransactionType;
  grossRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  bonusAmount: number;
  totalAmount: number;
  currency: Currency;
  status: CommissionTransactionStatus;
  period: CommissionPeriod;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Commission Settlement ────────────────────────────────────────────────────

export type CommissionSettlementStatus = "pending" | "processing" | "completed" | "failed";

export interface CommissionSettlement {
  id: string;
  tenantId: string;
  branchId: string;
  transactionIds: string[];
  totalAmount: number;
  currency: Currency;
  status: CommissionSettlementStatus;
  scheduledAt: string;
  processedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  externalReference: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Commission Approval ──────────────────────────────────────────────────────

export type CommissionApprovalStatus = "pending" | "approved" | "rejected";
export type CommissionApprovalDecision = "approve" | "reject";

export interface CommissionApproval {
  id: string;
  tenantId: string;
  transactionId: string;
  status: CommissionApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  decision: CommissionApprovalDecision | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Repository interfaces ────────────────────────────────────────────────────

export interface CommissionPlanRepository {
  findById(id: string): Promise<CommissionPlan | null>;
  findByTenantId(tenantId: string): Promise<CommissionPlan[]>;
  findActive(tenantId: string): Promise<CommissionPlan[]>;
  save(plan: CommissionPlan): Promise<CommissionPlan>;
  update(plan: CommissionPlan): Promise<CommissionPlan>;
}

export interface CommissionRuleRepository {
  findByPlanId(planId: string): Promise<CommissionRule[]>;
  findActiveByPlanId(planId: string): Promise<CommissionRule[]>;
  save(rule: CommissionRule): Promise<CommissionRule>;
  update(rule: CommissionRule): Promise<CommissionRule>;
}

export interface CommissionCampaignRepository {
  findById(id: string): Promise<CommissionCampaign | null>;
  findActive(tenantId: string, date: string): Promise<CommissionCampaign[]>;
  save(campaign: CommissionCampaign): Promise<CommissionCampaign>;
  update(campaign: CommissionCampaign): Promise<CommissionCampaign>;
}

export interface CommissionTargetRepository {
  findById(id: string): Promise<CommissionTarget | null>;
  findByBranchAndPeriod(
    branchId: string,
    planId: string,
    periodStart: string,
  ): Promise<CommissionTarget | null>;
  save(target: CommissionTarget): Promise<CommissionTarget>;
  update(target: CommissionTarget): Promise<CommissionTarget>;
}

export interface CommissionTransactionRepository {
  findById(id: string): Promise<CommissionTransaction | null>;
  findByBranchAndPeriod(
    branchId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<CommissionTransaction[]>;
  findPendingByBranch(branchId: string): Promise<CommissionTransaction[]>;
  save(transaction: CommissionTransaction): Promise<CommissionTransaction>;
  update(transaction: CommissionTransaction): Promise<CommissionTransaction>;
}

export interface CommissionSettlementRepository {
  findById(id: string): Promise<CommissionSettlement | null>;
  findByBranchId(branchId: string): Promise<CommissionSettlement[]>;
  save(settlement: CommissionSettlement): Promise<CommissionSettlement>;
  update(settlement: CommissionSettlement): Promise<CommissionSettlement>;
}

export interface CommissionApprovalRepository {
  findById(id: string): Promise<CommissionApproval | null>;
  findByTransactionId(transactionId: string): Promise<CommissionApproval | null>;
  save(approval: CommissionApproval): Promise<CommissionApproval>;
  update(approval: CommissionApproval): Promise<CommissionApproval>;
}
