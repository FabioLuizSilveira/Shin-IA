import { describe, it, expect, beforeEach, vi } from "vitest";
import { BillingService } from "../billing-service.js";
import { SettlementService } from "../settlement-service.js";
import type {
  BillingAccount,
  BillingAccountRepository,
  Invoice,
  InvoiceRepository,
  PaymentEventRepository,
  RevenueShare,
  RevenueShareRepository,
  Settlement,
  SettlementRepository,
  Subscription,
  SubscriptionPlan,
  SubscriptionRepository,
} from "../types.js";

// ─── Mock factories ───────────────────────────────────────────────────────────

const makePlan = (overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan => ({
  id: "plan-basic",
  name: "Basic",
  interval: "monthly",
  basePrice: 500,
  currency: "BRL",
  features: ["feature-a"],
  maxBranches: 5,
  maxUsers: 20,
  ...overrides,
});

const makeAccount = (overrides: Partial<BillingAccount> = {}): BillingAccount => ({
  id: "account-1",
  tenantId: "tenant-1",
  status: "active",
  currency: "BRL",
  billingCycle: "monthly",
  creditBalance: 0,
  overdueAmount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: "sub-1",
  billingAccountId: "account-1",
  tenantId: "tenant-1",
  planId: "plan-basic",
  status: "active",
  currentPeriodStart: "2026-01-01T00:00:00.000Z",
  currentPeriodEnd: "2026-02-01T00:00:00.000Z",
  trialEnd: null,
  cancelAt: null,
  cancelledAt: null,
  quantity: 1,
  unitPrice: 500,
  currency: "BRL",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: "inv-1",
  billingAccountId: "account-1",
  tenantId: "tenant-1",
  subscriptionId: "sub-1",
  status: "open",
  currency: "BRL",
  subtotal: 500,
  taxAmount: 0,
  total: 500,
  amountPaid: 0,
  amountDue: 500,
  dueDate: "2026-02-01T00:00:00.000Z",
  paidAt: null,
  periodStart: "2026-01-01T00:00:00.000Z",
  periodEnd: "2026-02-01T00:00:00.000Z",
  lines: [],
  metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeRevenueShare = (overrides: Partial<RevenueShare> = {}): RevenueShare => ({
  id: "rs-1",
  billingAccountId: "account-1",
  tenantId: "tenant-1",
  invoiceId: "inv-1",
  grossAmount: 500,
  platformFeePercent: 15,
  platformFeeAmount: 75,
  netAmount: 425,
  currency: "BRL",
  status: "pending",
  periodStart: "2026-01-01T00:00:00.000Z",
  periodEnd: "2026-02-01T00:00:00.000Z",
  paidAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeSettlement = (overrides: Partial<Settlement> = {}): Settlement => ({
  id: "settlement-1",
  billingAccountId: "account-1",
  tenantId: "tenant-1",
  revenueShareIds: ["rs-1"],
  totalAmount: 425,
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

function makeAccountRepo(account: BillingAccount | null = null): BillingAccountRepository {
  return {
    findById: vi.fn().mockResolvedValue(account),
    findByTenantId: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation((a: BillingAccount) => Promise.resolve(a)),
    update: vi.fn().mockImplementation((a: BillingAccount) => Promise.resolve(a)),
  };
}

function makeSubscriptionRepo(plan: SubscriptionPlan | null = makePlan()): SubscriptionRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByBillingAccountId: vi.fn().mockResolvedValue([]),
    findActivePlan: vi.fn().mockResolvedValue(null),
    findPlanById: vi.fn().mockResolvedValue(plan),
    save: vi.fn().mockImplementation((s: Subscription) => Promise.resolve(s)),
    update: vi.fn().mockImplementation((s: Subscription) => Promise.resolve(s)),
  };
}

function makeInvoiceRepo(invoice: Invoice | null = null): InvoiceRepository {
  return {
    findById: vi.fn().mockResolvedValue(invoice),
    findByBillingAccountId: vi.fn().mockResolvedValue([]),
    findOpenInvoices: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((i: Invoice) => Promise.resolve(i)),
    update: vi.fn().mockImplementation((i: Invoice) => Promise.resolve(i)),
  };
}

function makeRsRepo(
  shares: RevenueShare[] = [],
  byInvoice: RevenueShare | null = null,
): RevenueShareRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByInvoiceId: vi.fn().mockResolvedValue(byInvoice),
    findPendingByBillingAccount: vi.fn().mockResolvedValue(shares),
    save: vi.fn().mockImplementation((rs: RevenueShare) => Promise.resolve(rs)),
    update: vi.fn().mockImplementation((rs: RevenueShare) => Promise.resolve(rs)),
  };
}

function makeSettlementRepo(settlement: Settlement | null = null): SettlementRepository {
  return {
    findById: vi.fn().mockResolvedValue(settlement),
    findByBillingAccountId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((s: Settlement) => Promise.resolve(s)),
    update: vi.fn().mockImplementation((s: Settlement) => Promise.resolve(s)),
  };
}

function makeEventRepo(): PaymentEventRepository {
  return {
    save: vi.fn().mockImplementation((e) => Promise.resolve(e)),
    findByBillingAccountId: vi.fn().mockResolvedValue([]),
  };
}

// ─── BillingService tests ─────────────────────────────────────────────────────

describe("BillingService", () => {
  let service: BillingService;
  let accountRepo: BillingAccountRepository;
  let subscriptionRepo: SubscriptionRepository;
  let invoiceRepo: InvoiceRepository;
  let rsRepo: RevenueShareRepository;
  let eventRepo: PaymentEventRepository;

  beforeEach(() => {
    accountRepo = makeAccountRepo();
    subscriptionRepo = makeSubscriptionRepo();
    invoiceRepo = makeInvoiceRepo();
    rsRepo = makeRsRepo();
    eventRepo = makeEventRepo();
    service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);
  });

  describe("createBillingAccount", () => {
    it("creates account successfully", async () => {
      const account = await service.createBillingAccount({
        tenantId: "tenant-1",
        currency: "BRL",
        billingCycle: "monthly",
      });

      expect(account.tenantId).toBe("tenant-1");
      expect(account.status).toBe("active");
      expect(account.creditBalance).toBe(0);
      expect(accountRepo.save).toHaveBeenCalledOnce();
    });

    it("throws if account already exists for tenant", async () => {
      vi.mocked(accountRepo.findByTenantId).mockResolvedValue(makeAccount());

      await expect(
        service.createBillingAccount({
          tenantId: "tenant-1",
          currency: "BRL",
          billingCycle: "monthly",
        }),
      ).rejects.toThrow("already exists");
    });
  });

  describe("createSubscription", () => {
    it("creates active subscription when no trial", async () => {
      accountRepo = makeAccountRepo(makeAccount());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      const sub = await service.createSubscription({
        billingAccountId: "account-1",
        tenantId: "tenant-1",
        planId: "plan-basic",
      });

      expect(sub.status).toBe("active");
      expect(sub.trialEnd).toBeNull();
      expect(eventRepo.save).toHaveBeenCalledOnce();
    });

    it("creates trialing subscription when trialDays > 0", async () => {
      accountRepo = makeAccountRepo(makeAccount());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      const sub = await service.createSubscription({
        billingAccountId: "account-1",
        tenantId: "tenant-1",
        planId: "plan-basic",
        trialDays: 14,
      });

      expect(sub.status).toBe("trialing");
      expect(sub.trialEnd).not.toBeNull();
    });

    it("throws when billing account not found", async () => {
      await expect(
        service.createSubscription({ billingAccountId: "nope", tenantId: "t", planId: "p" }),
      ).rejects.toThrow("not found");
    });

    it("throws when billing account is not active", async () => {
      accountRepo = makeAccountRepo(makeAccount({ status: "suspended" }));
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      await expect(
        service.createSubscription({ billingAccountId: "account-1", tenantId: "t", planId: "p" }),
      ).rejects.toThrow("not active");
    });

    it("throws when plan not found", async () => {
      accountRepo = makeAccountRepo(makeAccount());
      subscriptionRepo = makeSubscriptionRepo(null);
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      await expect(
        service.createSubscription({
          billingAccountId: "account-1",
          tenantId: "t",
          planId: "nonexistent",
        }),
      ).rejects.toThrow("not found");
    });
  });

  describe("cancelSubscription", () => {
    it("cancels subscription successfully", async () => {
      vi.mocked(subscriptionRepo.findById).mockResolvedValue(makeSubscription());

      const sub = await service.cancelSubscription("sub-1");

      expect(sub.status).toBe("cancelled");
      expect(sub.cancelledAt).not.toBeNull();
      expect(eventRepo.save).toHaveBeenCalledOnce();
    });

    it("throws when subscription not found", async () => {
      await expect(service.cancelSubscription("nope")).rejects.toThrow("not found");
    });

    it("throws when already cancelled", async () => {
      vi.mocked(subscriptionRepo.findById).mockResolvedValue(
        makeSubscription({ status: "cancelled" }),
      );

      await expect(service.cancelSubscription("sub-1")).rejects.toThrow("already cancelled");
    });
  });

  describe("createInvoice", () => {
    it("creates invoice and calculates revenue share", async () => {
      accountRepo = makeAccountRepo(makeAccount());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      const invoice = await service.createInvoice({
        billingAccountId: "account-1",
        tenantId: "tenant-1",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
        dueDate: "2026-02-01T00:00:00.000Z",
        lines: [{ description: "Basic plan", quantity: 1, unitPrice: 500 }],
      });

      expect(invoice.status).toBe("open");
      expect(invoice.subtotal).toBe(500);
      expect(invoice.total).toBe(500);
      expect(invoice.amountDue).toBe(500);
      expect(rsRepo.save).toHaveBeenCalledOnce();
    });

    it("applies tax rate correctly", async () => {
      accountRepo = makeAccountRepo(makeAccount());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      const invoice = await service.createInvoice({
        billingAccountId: "account-1",
        tenantId: "tenant-1",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
        dueDate: "2026-02-01T00:00:00.000Z",
        lines: [{ description: "Plan", quantity: 1, unitPrice: 1000 }],
        taxRate: 0.1,
      });

      expect(invoice.taxAmount).toBe(100);
      expect(invoice.total).toBe(1100);
    });

    it("calculates lines total correctly for multiple items", async () => {
      accountRepo = makeAccountRepo(makeAccount());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      const invoice = await service.createInvoice({
        billingAccountId: "account-1",
        tenantId: "tenant-1",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
        dueDate: "2026-02-01T00:00:00.000Z",
        lines: [
          { description: "Plan A", quantity: 2, unitPrice: 100 },
          { description: "Plan B", quantity: 3, unitPrice: 50 },
        ],
      });

      expect(invoice.subtotal).toBe(350);
      expect(invoice.lines).toHaveLength(2);
    });
  });

  describe("payInvoice", () => {
    it("marks invoice as paid", async () => {
      invoiceRepo = makeInvoiceRepo(makeInvoice());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      const invoice = await service.payInvoice({ invoiceId: "inv-1", amount: 500 });

      expect(invoice.status).toBe("paid");
      expect(invoice.amountPaid).toBe(500);
      expect(invoice.amountDue).toBe(0);
      expect(invoice.paidAt).not.toBeNull();
    });

    it("updates revenue share status to calculated on payment", async () => {
      invoiceRepo = makeInvoiceRepo(makeInvoice());
      rsRepo = makeRsRepo([], makeRevenueShare());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      await service.payInvoice({ invoiceId: "inv-1", amount: 500 });

      expect(rsRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: "calculated" }));
    });

    it("throws when invoice not found", async () => {
      await expect(service.payInvoice({ invoiceId: "nope", amount: 100 })).rejects.toThrow(
        "not found",
      );
    });

    it("throws when invoice already paid", async () => {
      invoiceRepo = makeInvoiceRepo(makeInvoice({ status: "paid" }));
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      await expect(service.payInvoice({ invoiceId: "inv-1", amount: 500 })).rejects.toThrow(
        "already paid",
      );
    });

    it("throws when payment amount is less than due", async () => {
      invoiceRepo = makeInvoiceRepo(makeInvoice());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      await expect(service.payInvoice({ invoiceId: "inv-1", amount: 100 })).rejects.toThrow(
        "less than amount due",
      );
    });
  });

  describe("voidInvoice", () => {
    it("voids an open invoice", async () => {
      invoiceRepo = makeInvoiceRepo(makeInvoice());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      const invoice = await service.voidInvoice("inv-1");

      expect(invoice.status).toBe("void");
      expect(invoice.amountDue).toBe(0);
    });

    it("throws when trying to void a paid invoice", async () => {
      invoiceRepo = makeInvoiceRepo(makeInvoice({ status: "paid" }));
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);

      await expect(service.voidInvoice("inv-1")).rejects.toThrow("cannot void a paid invoice");
    });
  });

  describe("getAccountSummary", () => {
    it("returns summary with all components", async () => {
      accountRepo = makeAccountRepo(makeAccount());
      service = new BillingService(accountRepo, subscriptionRepo, invoiceRepo, rsRepo, eventRepo);
      const summary = await service.getAccountSummary("account-1");

      expect(summary.account.id).toBe("account-1");
      expect(summary.activeSubscription).toBeNull();
      expect(summary.openInvoices).toHaveLength(0);
      expect(summary.pendingRevenueShares).toHaveLength(0);
    });

    it("throws when account not found", async () => {
      await expect(service.getAccountSummary("nope")).rejects.toThrow("not found");
    });
  });
});

// ─── SettlementService tests ──────────────────────────────────────────────────

describe("SettlementService", () => {
  let service: SettlementService;
  let rsRepo: RevenueShareRepository;
  let settlementRepo: SettlementRepository;
  let eventRepo: PaymentEventRepository;

  const rs1 = makeRevenueShare({ id: "rs-1", status: "pending" });
  const rs2 = makeRevenueShare({ id: "rs-2", status: "pending", netAmount: 300 });

  beforeEach(() => {
    rsRepo = makeRsRepo([rs1, rs2]);
    settlementRepo = makeSettlementRepo();
    eventRepo = makeEventRepo();
    service = new SettlementService(rsRepo, settlementRepo, eventRepo);
  });

  describe("createSettlement", () => {
    it("creates settlement and marks revenue shares as approved", async () => {
      const settlement = await service.createSettlement({
        billingAccountId: "account-1",
        tenantId: "tenant-1",
        revenueShareIds: ["rs-1"],
        scheduledAt: "2026-02-01T00:00:00.000Z",
      });

      expect(settlement.revenueShareIds).toEqual(["rs-1"]);
      expect(settlement.totalAmount).toBe(425);
      expect(settlement.status).toBe("pending");
      expect(rsRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
    });

    it("throws when no revenue share IDs provided", async () => {
      await expect(
        service.createSettlement({
          billingAccountId: "account-1",
          tenantId: "tenant-1",
          revenueShareIds: [],
          scheduledAt: "2026-02-01T00:00:00.000Z",
        }),
      ).rejects.toThrow("at least one");
    });

    it("throws when revenue share is not available", async () => {
      await expect(
        service.createSettlement({
          billingAccountId: "account-1",
          tenantId: "tenant-1",
          revenueShareIds: ["rs-nonexistent"],
          scheduledAt: "2026-02-01T00:00:00.000Z",
        }),
      ).rejects.toThrow("not available");
    });
  });

  describe("processSettlement", () => {
    it("marks settlement as completed", async () => {
      settlementRepo = makeSettlementRepo(makeSettlement());
      service = new SettlementService(rsRepo, settlementRepo, eventRepo);

      const settlement = await service.processSettlement("settlement-1", "ext-ref-123");

      expect(settlement.status).toBe("completed");
      expect(settlement.externalReference).toBe("ext-ref-123");
      expect(settlement.processedAt).not.toBeNull();
      expect(eventRepo.save).toHaveBeenCalledOnce();
    });

    it("throws when settlement not in pending status", async () => {
      settlementRepo = makeSettlementRepo(makeSettlement({ status: "completed" }));
      service = new SettlementService(rsRepo, settlementRepo, eventRepo);

      await expect(service.processSettlement("settlement-1", "ref")).rejects.toThrow(
        "not in pending",
      );
    });
  });

  describe("failSettlement", () => {
    it("marks settlement as failed with reason", async () => {
      settlementRepo = makeSettlementRepo(makeSettlement());
      service = new SettlementService(rsRepo, settlementRepo, eventRepo);

      const settlement = await service.failSettlement("settlement-1", "Insufficient funds");

      expect(settlement.status).toBe("failed");
      expect(settlement.failureReason).toBe("Insufficient funds");
      expect(eventRepo.save).toHaveBeenCalledOnce();
    });
  });

  describe("reconcile", () => {
    it("returns reconciliation report with correct totals", async () => {
      rsRepo = makeRsRepo([rs1]);
      settlementRepo = {
        ...makeSettlementRepo(),
        findByBillingAccountId: vi
          .fn()
          .mockResolvedValue([makeSettlement({ status: "completed", totalAmount: 425 })]),
      };
      service = new SettlementService(rsRepo, settlementRepo, eventRepo);

      const report = await service.reconcile(
        "account-1",
        "2026-01-01T00:00:00.000Z",
        "2026-02-01T00:00:00.000Z",
      );

      expect(report.totalGross).toBe(500);
      expect(report.totalFees).toBe(75);
      expect(report.totalNet).toBe(425);
      expect(report.settledAmount).toBe(425);
      expect(report.pendingAmount).toBe(0);
    });
  });
});
