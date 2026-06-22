import type {
  CommissionApproval,
  CommissionApprovalRepository,
  CommissionCampaign,
  CommissionCampaignRepository,
  CommissionPlan,
  CommissionPlanRepository,
  CommissionRuleRepository,
  CommissionSettlement,
  CommissionSettlementRepository,
  CommissionTarget,
  CommissionTargetRepository,
  CommissionTransaction,
  CommissionTransactionRepository,
  CommissionTransactionStatus,
  Currency,
} from "./types.js";
import { CommissionCalculator, type CalculationContext } from "./commission-calculator.js";

export interface EarnCommissionInput {
  tenantId: string;
  branchId: string;
  planId: string;
  operationId?: string;
  grossRevenue: number;
  operationCount?: number;
  resourceType?: string;
  period: string;
  periodStart: string;
  periodEnd: string;
}

export interface CreateTargetInput {
  tenantId: string;
  planId: string;
  branchId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  targetRevenue: number;
  targetOperations?: number;
  currency: Currency;
}

export interface RequestApprovalInput {
  tenantId: string;
  transactionId: string;
  requestedBy: string;
}

export interface ReviewApprovalInput {
  approvalId: string;
  reviewedBy: string;
  decision: "approve" | "reject";
  notes?: string;
}

export interface CreateSettlementInput {
  tenantId: string;
  branchId: string;
  transactionIds: string[];
  scheduledAt: string;
}

export class CommissionService {
  private calculator = new CommissionCalculator();

  constructor(
    private plans: CommissionPlanRepository,
    private rules: CommissionRuleRepository,
    private campaigns: CommissionCampaignRepository,
    private targets: CommissionTargetRepository,
    private transactions: CommissionTransactionRepository,
    private settlements: CommissionSettlementRepository,
    private approvals: CommissionApprovalRepository,
  ) {}

  async earnCommission(input: EarnCommissionInput): Promise<CommissionTransaction> {
    const plan = await this.plans.findById(input.planId);
    if (!plan) throw new Error(`commission plan ${input.planId} not found`);
    if (plan.status !== "active") throw new Error(`commission plan is not active`);

    const ruleList = await this.rules.findActiveByPlanId(input.planId);

    const context: CalculationContext = {
      branchId: input.branchId,
      grossRevenue: input.grossRevenue,
      operationCount: input.operationCount ?? 1,
      resourceType: input.resourceType,
      date: new Date().toISOString(),
    };

    const result = this.calculator.calculate(plan, ruleList, context);

    // Check for active campaigns
    const activeCampaigns = await this.campaigns.findActive(input.tenantId, context.date);
    const eligibleCampaign = activeCampaigns.find(
      (c) =>
        c.planId === input.planId &&
        (c.eligibleBranchIds.length === 0 || c.eligibleBranchIds.includes(input.branchId)),
    );

    let campaignBonus = 0;
    let campaignId: string | null = null;
    if (eligibleCampaign) {
      campaignBonus = result.commissionAmount * eligibleCampaign.bonusRate;
      if (eligibleCampaign.maxPayout !== null) {
        campaignBonus = Math.min(campaignBonus, eligibleCampaign.maxPayout);
      }
      campaignId = eligibleCampaign.id;
    }

    const totalBonus = result.bonusAmount + campaignBonus;
    const totalAmount = result.commissionAmount + totalBonus;

    const now = new Date().toISOString();
    const transaction: CommissionTransaction = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      planId: input.planId,
      campaignId,
      targetId: null,
      operationId: input.operationId ?? null,
      type: "earned",
      grossRevenue: input.grossRevenue,
      commissionRate: result.commissionRate,
      commissionAmount: result.commissionAmount,
      bonusAmount: totalBonus,
      totalAmount,
      currency: result.currency,
      status: "pending",
      period: input.period as CommissionTransaction["period"],
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.transactions.save(transaction);

    // Update target progress if applicable
    await this.updateTargetProgress(
      input.tenantId,
      input.branchId,
      input.planId,
      input.periodStart,
      input.grossRevenue,
      1,
    );

    return saved;
  }

  async createPlan(
    plan: Omit<CommissionPlan, "id" | "createdAt" | "updatedAt">,
  ): Promise<CommissionPlan> {
    const now = new Date().toISOString();
    const full: CommissionPlan = {
      ...plan,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    return this.plans.save(full);
  }

  async createTarget(input: CreateTargetInput): Promise<CommissionTarget> {
    const plan = await this.plans.findById(input.planId);
    if (!plan) throw new Error(`commission plan ${input.planId} not found`);

    const existing = await this.targets.findByBranchAndPeriod(
      input.branchId,
      input.planId,
      input.periodStart,
    );
    if (existing) throw new Error(`target already exists for this branch and period`);

    const now = new Date().toISOString();
    const target: CommissionTarget = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      planId: input.planId,
      branchId: input.branchId,
      period: input.period as CommissionTarget["period"],
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      targetRevenue: input.targetRevenue,
      targetOperations: input.targetOperations ?? null,
      achievedRevenue: 0,
      achievedOperations: 0,
      status: "pending",
      currency: input.currency,
      createdAt: now,
      updatedAt: now,
    };

    return this.targets.save(target);
  }

  async createCampaign(
    campaign: Omit<CommissionCampaign, "id" | "createdAt" | "updatedAt">,
  ): Promise<CommissionCampaign> {
    const now = new Date().toISOString();
    const full: CommissionCampaign = {
      ...campaign,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    return this.campaigns.save(full);
  }

  async requestApproval(input: RequestApprovalInput): Promise<CommissionApproval> {
    const transaction = await this.transactions.findById(input.transactionId);
    if (!transaction) throw new Error(`transaction ${input.transactionId} not found`);
    if (transaction.status !== "pending") {
      throw new Error(`transaction is not in pending status`);
    }

    const existing = await this.approvals.findByTransactionId(input.transactionId);
    if (existing) throw new Error(`approval already requested for this transaction`);

    const now = new Date().toISOString();
    const approval: CommissionApproval = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      transactionId: input.transactionId,
      status: "pending",
      requestedBy: input.requestedBy,
      requestedAt: now,
      reviewedBy: null,
      reviewedAt: null,
      decision: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.approvals.save(approval);
  }

  async reviewApproval(input: ReviewApprovalInput): Promise<CommissionApproval> {
    const approval = await this.approvals.findById(input.approvalId);
    if (!approval) throw new Error(`approval ${input.approvalId} not found`);
    if (approval.status !== "pending") throw new Error(`approval is not pending`);

    const now = new Date().toISOString();
    const updated: CommissionApproval = {
      ...approval,
      status: input.decision === "approve" ? "approved" : "rejected",
      reviewedBy: input.reviewedBy,
      reviewedAt: now,
      decision: input.decision,
      notes: input.notes ?? null,
      updatedAt: now,
    };

    const saved = await this.approvals.update(updated);

    // Update transaction status
    const transaction = await this.transactions.findById(approval.transactionId);
    if (transaction) {
      const newStatus: CommissionTransactionStatus =
        input.decision === "approve" ? "approved" : "rejected";
      await this.transactions.update({ ...transaction, status: newStatus, updatedAt: now });
    }

    return saved;
  }

  async createSettlement(input: CreateSettlementInput): Promise<CommissionSettlement> {
    if (input.transactionIds.length === 0) {
      throw new Error("settlement must include at least one transaction");
    }

    const pendingTransactions = await this.transactions.findPendingByBranch(input.branchId);
    const pendingIds = new Set(pendingTransactions.map((t) => t.id));

    for (const id of input.transactionIds) {
      if (!pendingIds.has(id)) {
        throw new Error(`transaction ${id} is not available for settlement`);
      }
    }

    const selectedTransactions = pendingTransactions.filter((t) =>
      input.transactionIds.includes(t.id),
    );
    const totalAmount = selectedTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const currency = selectedTransactions[0]!.currency;

    const now = new Date().toISOString();
    const settlement: CommissionSettlement = {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      transactionIds: input.transactionIds,
      totalAmount,
      currency,
      status: "pending",
      scheduledAt: input.scheduledAt,
      processedAt: null,
      failedAt: null,
      failureReason: null,
      externalReference: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.settlements.save(settlement);
  }

  async processSettlement(
    settlementId: string,
    externalReference: string,
  ): Promise<CommissionSettlement> {
    const settlement = await this.settlements.findById(settlementId);
    if (!settlement) throw new Error(`settlement ${settlementId} not found`);
    if (settlement.status !== "pending") throw new Error(`settlement is not in pending status`);

    const now = new Date().toISOString();
    const updated: CommissionSettlement = {
      ...settlement,
      status: "completed",
      processedAt: now,
      externalReference,
      updatedAt: now,
    };

    const saved = await this.settlements.update(updated);

    // Mark transactions as paid
    const pending = await this.transactions.findPendingByBranch(settlement.branchId);
    const settledIds = new Set(settlement.transactionIds);
    await Promise.all(
      pending
        .filter((t) => settledIds.has(t.id))
        .map((t) => this.transactions.update({ ...t, status: "paid", updatedAt: now })),
    );

    return saved;
  }

  private async updateTargetProgress(
    _tenantId: string,
    branchId: string,
    planId: string,
    periodStart: string,
    revenue: number,
    operations: number,
  ): Promise<void> {
    const target = await this.targets.findByBranchAndPeriod(branchId, planId, periodStart);
    if (!target || target.status === "achieved") return;

    const newRevenue = target.achievedRevenue + revenue;
    const newOperations = target.achievedOperations + operations;

    const revenueAchieved = newRevenue >= target.targetRevenue;
    const opsAchieved =
      target.targetOperations === null || newOperations >= target.targetOperations;

    const newStatus =
      revenueAchieved && opsAchieved
        ? "achieved"
        : revenueAchieved || opsAchieved
          ? "partial"
          : "pending";

    await this.targets.update({
      ...target,
      achievedRevenue: newRevenue,
      achievedOperations: newOperations,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  }
}
