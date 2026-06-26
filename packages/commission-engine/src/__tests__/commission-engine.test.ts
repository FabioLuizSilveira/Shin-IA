import { describe, it, expect, vi } from "vitest";
import { CommissionCalculator } from "../commission-calculator.js";
import { CommissionService } from "../commission-service.js";
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
} from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makePlan = (overrides: Partial<CommissionPlan> = {}): CommissionPlan => ({
  id: "plan-1",
  tenantId: "tenant-1",
  name: "Standard Commission",
  description: "Standard plan",
  calculationType: "percentage",
  baseRate: 0.1,
  tiers: [],
  currency: "BRL",
  period: "monthly",
  status: "active",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  effectiveUntil: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeTransaction = (
  overrides: Partial<CommissionTransaction> = {},
): CommissionTransaction => ({
  id: "tx-1",
  tenantId: "tenant-1",
  branchId: "branch-1",
  planId: "plan-1",
  campaignId: null,
  targetId: null,
  operationId: null,
  type: "earned",
  grossRevenue: 1000,
  commissionRate: 0.1,
  commissionAmount: 100,
  bonusAmount: 0,
  totalAmount: 100,
  currency: "BRL",
  status: "pending",
  period: "monthly",
  periodStart: "2026-01-01T00:00:00.000Z",
  periodEnd: "2026-02-01T00:00:00.000Z",
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeTarget = (overrides: Partial<CommissionTarget> = {}): CommissionTarget => ({
  id: "target-1",
  tenantId: "tenant-1",
  planId: "plan-1",
  branchId: "branch-1",
  period: "monthly",
  periodStart: "2026-01-01T00:00:00.000Z",
  periodEnd: "2026-02-01T00:00:00.000Z",
  targetRevenue: 10000,
  targetOperations: null,
  achievedRevenue: 0,
  achievedOperations: 0,
  status: "pending",
  currency: "BRL",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeApproval = (overrides: Partial<CommissionApproval> = {}): CommissionApproval => ({
  id: "approval-1",
  tenantId: "tenant-1",
  transactionId: "tx-1",
  status: "pending",
  requestedBy: "user-1",
  requestedAt: "2026-01-01T00:00:00.000Z",
  reviewedBy: null,
  reviewedAt: null,
  decision: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeSettlement = (overrides: Partial<CommissionSettlement> = {}): CommissionSettlement => ({
  id: "settlement-1",
  tenantId: "tenant-1",
  branchId: "branch-1",
  transactionIds: ["tx-1"],
  totalAmount: 100,
  currency: "BRL",
  status: "pending",
  scheduledAt: "2026-02-01T00:00:00.000Z",
  processedAt: null,
  failedAt: null,
  failureReason: null,
  externalReference: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// ─── Repo mocks ───────────────────────────────────────────────────────────────

function makePlanRepo(plan: CommissionPlan | null = makePlan()): CommissionPlanRepository {
  return {
    findById: vi.fn().mockResolvedValue(plan),
    findByTenantId: vi.fn().mockResolvedValue([]),
    findActive: vi.fn().mockResolvedValue(plan ? [plan] : []),
    save: vi.fn().mockImplementation((p: CommissionPlan) => Promise.resolve(p)),
    update: vi.fn().mockImplementation((p: CommissionPlan) => Promise.resolve(p)),
  };
}

function makeRuleRepo(): CommissionRuleRepository {
  return {
    findByPlanId: vi.fn().mockResolvedValue([]),
    findActiveByPlanId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((r) => Promise.resolve(r)),
    update: vi.fn().mockImplementation((r) => Promise.resolve(r)),
  };
}

function makeCampaignRepo(campaigns: CommissionCampaign[] = []): CommissionCampaignRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findActive: vi.fn().mockResolvedValue(campaigns),
    save: vi.fn().mockImplementation((c: CommissionCampaign) => Promise.resolve(c)),
    update: vi.fn().mockImplementation((c: CommissionCampaign) => Promise.resolve(c)),
  };
}

function makeTargetRepo(target: CommissionTarget | null = null): CommissionTargetRepository {
  return {
    findById: vi.fn().mockResolvedValue(target),
    findByBranchAndPeriod: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation((t: CommissionTarget) => Promise.resolve(t)),
    update: vi.fn().mockImplementation((t: CommissionTarget) => Promise.resolve(t)),
  };
}

function makeTransactionRepo(
  transactions: CommissionTransaction[] = [],
  single: CommissionTransaction | null = null,
): CommissionTransactionRepository {
  return {
    findById: vi.fn().mockResolvedValue(single),
    findByBranchAndPeriod: vi.fn().mockResolvedValue(transactions),
    findPendingByBranch: vi.fn().mockResolvedValue(transactions),
    save: vi.fn().mockImplementation((t: CommissionTransaction) => Promise.resolve(t)),
    update: vi.fn().mockImplementation((t: CommissionTransaction) => Promise.resolve(t)),
  };
}

function makeSettlementRepo(
  settlement: CommissionSettlement | null = null,
): CommissionSettlementRepository {
  return {
    findById: vi.fn().mockResolvedValue(settlement),
    findByBranchId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((s: CommissionSettlement) => Promise.resolve(s)),
    update: vi.fn().mockImplementation((s: CommissionSettlement) => Promise.resolve(s)),
  };
}

function makeApprovalRepo(
  approval: CommissionApproval | null = null,
): CommissionApprovalRepository {
  return {
    findById: vi.fn().mockResolvedValue(approval),
    findByTransactionId: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation((a: CommissionApproval) => Promise.resolve(a)),
    update: vi.fn().mockImplementation((a: CommissionApproval) => Promise.resolve(a)),
  };
}

function makeService(
  overrides: {
    planRepo?: CommissionPlanRepository;
    ruleRepo?: CommissionRuleRepository;
    campaignRepo?: CommissionCampaignRepository;
    targetRepo?: CommissionTargetRepository;
    transactionRepo?: CommissionTransactionRepository;
    settlementRepo?: CommissionSettlementRepository;
    approvalRepo?: CommissionApprovalRepository;
  } = {},
): CommissionService {
  return new CommissionService(
    overrides.planRepo ?? makePlanRepo(),
    overrides.ruleRepo ?? makeRuleRepo(),
    overrides.campaignRepo ?? makeCampaignRepo(),
    overrides.targetRepo ?? makeTargetRepo(),
    overrides.transactionRepo ?? makeTransactionRepo(),
    overrides.settlementRepo ?? makeSettlementRepo(),
    overrides.approvalRepo ?? makeApprovalRepo(),
  );
}

// ─── CommissionCalculator tests ───────────────────────────────────────────────

describe("CommissionCalculator", () => {
  const calculator = new CommissionCalculator();

  describe("flat calculation", () => {
    it("returns base rate as flat amount", () => {
      const plan = makePlan({ calculationType: "flat", baseRate: 50 });
      const result = calculator.calculate(plan, [], {
        branchId: "b1",
        grossRevenue: 1000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      expect(result.commissionAmount).toBe(50);
    });
  });

  describe("percentage calculation", () => {
    it("calculates percentage of gross revenue", () => {
      const plan = makePlan({ calculationType: "percentage", baseRate: 0.1 });
      const result = calculator.calculate(plan, [], {
        branchId: "b1",
        grossRevenue: 1000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      expect(result.commissionAmount).toBe(100);
      expect(result.commissionRate).toBe(0.1);
    });
  });

  describe("tiered calculation", () => {
    it("calculates tiered commission correctly", () => {
      const plan = makePlan({
        calculationType: "tiered",
        baseRate: 0,
        tiers: [
          { minAmount: 0, maxAmount: 1000, rate: 0.05 },
          { minAmount: 1000, maxAmount: 5000, rate: 0.1 },
          { minAmount: 5000, maxAmount: null, rate: 0.15 },
        ],
      });
      const result = calculator.calculate(plan, [], {
        branchId: "b1",
        grossRevenue: 2000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      // 1000 * 0.05 = 50 for first tier, 1000 * 0.1 = 100 for second tier = 150
      expect(result.commissionAmount).toBe(150);
    });

    it("handles empty tiers returning 0", () => {
      const plan = makePlan({ calculationType: "tiered", baseRate: 0, tiers: [] });
      const result = calculator.calculate(plan, [], {
        branchId: "b1",
        grossRevenue: 1000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      expect(result.commissionAmount).toBe(0);
    });
  });

  describe("rule application", () => {
    it("applies rate override from always rule", () => {
      const plan = makePlan({ baseRate: 0.1 });
      const rule = {
        id: "rule-1",
        planId: "plan-1",
        tenantId: "tenant-1",
        name: "Override",
        priority: 1,
        conditionType: "always" as const,
        conditionValue: null,
        rateOverride: 0.2,
        bonusAmount: null,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      const result = calculator.calculate(plan, [rule], {
        branchId: "b1",
        grossRevenue: 1000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      expect(result.commissionRate).toBe(0.2);
      expect(result.commissionAmount).toBe(200);
      expect(result.appliedRules).toContain("rule-1");
    });

    it("applies bonus from revenue_threshold rule", () => {
      const plan = makePlan({ baseRate: 0.1 });
      const rule = {
        id: "rule-bonus",
        planId: "plan-1",
        tenantId: "tenant-1",
        name: "High Revenue Bonus",
        priority: 1,
        conditionType: "revenue_threshold" as const,
        conditionValue: 5000,
        rateOverride: null,
        bonusAmount: 500,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      const result = calculator.calculate(plan, [rule], {
        branchId: "b1",
        grossRevenue: 10000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      expect(result.bonusAmount).toBe(500);
      expect(result.totalAmount).toBe(1500);
    });

    it("skips rule when condition not met", () => {
      const plan = makePlan({ baseRate: 0.1 });
      const rule = {
        id: "rule-skip",
        planId: "plan-1",
        tenantId: "tenant-1",
        name: "High Revenue Only",
        priority: 1,
        conditionType: "revenue_threshold" as const,
        conditionValue: 50000,
        rateOverride: 0.5,
        bonusAmount: null,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      const result = calculator.calculate(plan, [rule], {
        branchId: "b1",
        grossRevenue: 1000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      expect(result.appliedRules).toHaveLength(0);
      expect(result.commissionRate).toBe(0.1);
    });

    it("skips inactive rules", () => {
      const plan = makePlan({ baseRate: 0.1 });
      const rule = {
        id: "rule-inactive",
        planId: "plan-1",
        tenantId: "tenant-1",
        name: "Inactive",
        priority: 1,
        conditionType: "always" as const,
        conditionValue: null,
        rateOverride: 0.5,
        bonusAmount: null,
        isActive: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      const result = calculator.calculate(plan, [rule], {
        branchId: "b1",
        grossRevenue: 1000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      expect(result.appliedRules).toHaveLength(0);
    });

    it("evaluates branch condition", () => {
      const plan = makePlan({ baseRate: 0.1 });
      const rule = {
        id: "rule-branch",
        planId: "plan-1",
        tenantId: "tenant-1",
        name: "Branch-specific",
        priority: 1,
        conditionType: "branch" as const,
        conditionValue: "branch-special",
        rateOverride: 0.2,
        bonusAmount: null,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const matchResult = calculator.calculate(plan, [rule], {
        branchId: "branch-special",
        grossRevenue: 1000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      expect(matchResult.appliedRules).toContain("rule-branch");

      const noMatchResult = calculator.calculate(plan, [rule], {
        branchId: "other-branch",
        grossRevenue: 1000,
        operationCount: 1,
        date: "2026-01-01T00:00:00.000Z",
      });
      expect(noMatchResult.appliedRules).toHaveLength(0);
    });
  });
});

// ─── CommissionService tests ──────────────────────────────────────────────────

describe("CommissionService", () => {
  describe("earnCommission", () => {
    it("creates commission transaction", async () => {
      const service = makeService();
      const tx = await service.earnCommission({
        tenantId: "tenant-1",
        branchId: "branch-1",
        planId: "plan-1",
        grossRevenue: 1000,
        period: "monthly",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      });

      expect(tx.commissionAmount).toBe(100); // 1000 * 0.1
      expect(tx.status).toBe("pending");
      expect(tx.type).toBe("earned");
    });

    it("applies campaign bonus", async () => {
      const campaign: CommissionCampaign = {
        id: "campaign-1",
        tenantId: "tenant-1",
        planId: "plan-1",
        name: "Summer Campaign",
        description: "",
        status: "active",
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T00:00:00.000Z",
        bonusRate: 0.5,
        maxPayout: null,
        eligibleBranchIds: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const service = makeService({ campaignRepo: makeCampaignRepo([campaign]) });
      const tx = await service.earnCommission({
        tenantId: "tenant-1",
        branchId: "branch-1",
        planId: "plan-1",
        grossRevenue: 1000,
        period: "monthly",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      });

      // 100 base + 50 campaign bonus (50% of 100) = 150
      expect(tx.bonusAmount).toBe(50);
      expect(tx.totalAmount).toBe(150);
      expect(tx.campaignId).toBe("campaign-1");
    });

    it("caps campaign bonus at maxPayout", async () => {
      const campaign: CommissionCampaign = {
        id: "campaign-capped",
        tenantId: "tenant-1",
        planId: "plan-1",
        name: "Capped Campaign",
        description: "",
        status: "active",
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T00:00:00.000Z",
        bonusRate: 10,
        maxPayout: 20,
        eligibleBranchIds: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      const service = makeService({ campaignRepo: makeCampaignRepo([campaign]) });
      const tx = await service.earnCommission({
        tenantId: "tenant-1",
        branchId: "branch-1",
        planId: "plan-1",
        grossRevenue: 1000,
        period: "monthly",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      });

      expect(tx.bonusAmount).toBe(20); // capped at maxPayout
    });

    it("throws when plan not found", async () => {
      const service = makeService({ planRepo: makePlanRepo(null) });
      await expect(
        service.earnCommission({
          tenantId: "t",
          branchId: "b",
          planId: "nope",
          grossRevenue: 100,
          period: "monthly",
          periodStart: "2026-01-01T00:00:00.000Z",
          periodEnd: "2026-02-01T00:00:00.000Z",
        }),
      ).rejects.toThrow("not found");
    });

    it("throws when plan is not active", async () => {
      const service = makeService({ planRepo: makePlanRepo(makePlan({ status: "inactive" })) });
      await expect(
        service.earnCommission({
          tenantId: "t",
          branchId: "b",
          planId: "plan-1",
          grossRevenue: 100,
          period: "monthly",
          periodStart: "2026-01-01T00:00:00.000Z",
          periodEnd: "2026-02-01T00:00:00.000Z",
        }),
      ).rejects.toThrow("not active");
    });
  });

  describe("createTarget", () => {
    it("creates a commission target", async () => {
      const service = makeService();
      const target = await service.createTarget({
        tenantId: "tenant-1",
        planId: "plan-1",
        branchId: "branch-1",
        period: "monthly",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
        targetRevenue: 10000,
        currency: "BRL",
      });

      expect(target.status).toBe("pending");
      expect(target.achievedRevenue).toBe(0);
      expect(target.targetRevenue).toBe(10000);
    });

    it("throws when target already exists", async () => {
      const targetRepo = makeTargetRepo();
      vi.mocked(targetRepo.findByBranchAndPeriod).mockResolvedValue(makeTarget());
      const service = makeService({ targetRepo });

      await expect(
        service.createTarget({
          tenantId: "tenant-1",
          planId: "plan-1",
          branchId: "branch-1",
          period: "monthly",
          periodStart: "2026-01-01T00:00:00.000Z",
          periodEnd: "2026-02-01T00:00:00.000Z",
          targetRevenue: 10000,
          currency: "BRL",
        }),
      ).rejects.toThrow("already exists");
    });
  });

  describe("requestApproval", () => {
    it("creates approval request", async () => {
      const tx = makeTransaction();
      const transactionRepo = makeTransactionRepo([tx], tx);
      const service = makeService({ transactionRepo });

      const approval = await service.requestApproval({
        tenantId: "tenant-1",
        transactionId: "tx-1",
        requestedBy: "user-1",
      });

      expect(approval.status).toBe("pending");
      expect(approval.requestedBy).toBe("user-1");
    });

    it("throws when transaction not found", async () => {
      const service = makeService();
      await expect(
        service.requestApproval({ tenantId: "t", transactionId: "nope", requestedBy: "u" }),
      ).rejects.toThrow("not found");
    });

    it("throws when approval already exists", async () => {
      const tx = makeTransaction();
      const transactionRepo = makeTransactionRepo([tx], tx);
      const approvalRepo = makeApprovalRepo();
      vi.mocked(approvalRepo.findByTransactionId).mockResolvedValue(makeApproval());
      const service = makeService({ transactionRepo, approvalRepo });

      await expect(
        service.requestApproval({ tenantId: "tenant-1", transactionId: "tx-1", requestedBy: "u" }),
      ).rejects.toThrow("already requested");
    });
  });

  describe("reviewApproval", () => {
    it("approves and updates transaction status", async () => {
      const tx = makeTransaction();
      const approvalRepo = makeApprovalRepo(makeApproval());
      const transactionRepo = makeTransactionRepo([tx], tx);
      const service = makeService({ approvalRepo, transactionRepo });

      const approval = await service.reviewApproval({
        approvalId: "approval-1",
        reviewedBy: "manager-1",
        decision: "approve",
      });

      expect(approval.status).toBe("approved");
      expect(approval.decision).toBe("approve");
      expect(transactionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "approved" }),
      );
    });

    it("rejects and updates transaction status", async () => {
      const tx = makeTransaction();
      const approvalRepo = makeApprovalRepo(makeApproval());
      const transactionRepo = makeTransactionRepo([tx], tx);
      const service = makeService({ approvalRepo, transactionRepo });

      const approval = await service.reviewApproval({
        approvalId: "approval-1",
        reviewedBy: "manager-1",
        decision: "reject",
        notes: "Does not meet criteria",
      });

      expect(approval.status).toBe("rejected");
      expect(approval.notes).toBe("Does not meet criteria");
    });

    it("throws when approval not found", async () => {
      const service = makeService();
      await expect(
        service.reviewApproval({ approvalId: "nope", reviewedBy: "u", decision: "approve" }),
      ).rejects.toThrow("not found");
    });
  });

  describe("createSettlement", () => {
    it("creates settlement from pending transactions", async () => {
      const tx = makeTransaction();
      const transactionRepo = makeTransactionRepo([tx], tx);
      const service = makeService({ transactionRepo });

      const settlement = await service.createSettlement({
        tenantId: "tenant-1",
        branchId: "branch-1",
        transactionIds: ["tx-1"],
        scheduledAt: "2026-02-01T00:00:00.000Z",
      });

      expect(settlement.totalAmount).toBe(100);
      expect(settlement.status).toBe("pending");
    });

    it("throws when no transactions provided", async () => {
      const service = makeService();
      await expect(
        service.createSettlement({
          tenantId: "t",
          branchId: "b",
          transactionIds: [],
          scheduledAt: "2026-02-01T00:00:00.000Z",
        }),
      ).rejects.toThrow("at least one");
    });

    it("throws when transaction not available", async () => {
      const service = makeService();
      await expect(
        service.createSettlement({
          tenantId: "t",
          branchId: "b",
          transactionIds: ["nonexistent"],
          scheduledAt: "2026-02-01T00:00:00.000Z",
        }),
      ).rejects.toThrow("not available");
    });
  });

  describe("processSettlement", () => {
    it("marks settlement completed and transactions paid", async () => {
      const tx = makeTransaction();
      const transactionRepo = makeTransactionRepo([tx], tx);
      const settlementRepo = makeSettlementRepo(makeSettlement());
      const service = makeService({ transactionRepo, settlementRepo });

      const settlement = await service.processSettlement("settlement-1", "ext-ref-123");

      expect(settlement.status).toBe("completed");
      expect(settlement.externalReference).toBe("ext-ref-123");
    });

    it("throws when settlement not in pending status", async () => {
      const settlementRepo = makeSettlementRepo(makeSettlement({ status: "completed" }));
      const service = makeService({ settlementRepo });

      await expect(service.processSettlement("settlement-1", "ref")).rejects.toThrow(
        "not in pending",
      );
    });
  });
});
