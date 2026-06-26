import type {
  RevenueShareRepository,
  Settlement,
  SettlementRepository,
  PaymentEvent,
  PaymentEventRepository,
  Currency,
} from "./types.js";

export interface CreateSettlementInput {
  billingAccountId: string;
  tenantId: string;
  revenueShareIds: string[];
  scheduledAt: string;
}

export interface ReconciliationReport {
  billingAccountId: string;
  periodStart: string;
  periodEnd: string;
  totalGross: number;
  totalFees: number;
  totalNet: number;
  settledAmount: number;
  pendingAmount: number;
  currency: Currency;
  revenueShareCount: number;
  settlementCount: number;
}

export class SettlementService {
  constructor(
    private revenueShares: RevenueShareRepository,
    private settlements: SettlementRepository,
    private events: PaymentEventRepository,
  ) {}

  async createSettlement(input: CreateSettlementInput): Promise<Settlement> {
    if (input.revenueShareIds.length === 0) {
      throw new Error("settlement must include at least one revenue share");
    }

    const pending = await this.revenueShares.findPendingByBillingAccount(input.billingAccountId);
    const pendingIds = new Set(pending.map((rs) => rs.id));

    for (const id of input.revenueShareIds) {
      if (!pendingIds.has(id)) {
        throw new Error(`revenue share ${id} is not available for settlement`);
      }
    }

    const selectedShares = pending.filter((rs) => input.revenueShareIds.includes(rs.id));
    const totalAmount = selectedShares.reduce((sum, rs) => sum + rs.netAmount, 0);
    const currency = selectedShares[0]!.currency;

    const now = new Date().toISOString();
    const settlement: Settlement = {
      id: crypto.randomUUID(),
      billingAccountId: input.billingAccountId,
      tenantId: input.tenantId,
      revenueShareIds: input.revenueShareIds,
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

    const saved = await this.settlements.save(settlement);

    // Mark revenue shares as approved
    await Promise.all(
      selectedShares.map((rs) =>
        this.revenueShares.update({ ...rs, status: "approved", updatedAt: now }),
      ),
    );

    return saved;
  }

  async processSettlement(settlementId: string, externalReference: string): Promise<Settlement> {
    const settlement = await this.settlements.findById(settlementId);
    if (!settlement) throw new Error(`settlement ${settlementId} not found`);
    if (settlement.status !== "pending") {
      throw new Error(`settlement is not in pending status`);
    }

    const now = new Date().toISOString();
    const updated: Settlement = {
      ...settlement,
      status: "completed",
      processedAt: now,
      externalReference,
      updatedAt: now,
    };

    const saved = await this.settlements.update(updated);

    // Mark all revenue shares as paid
    const allShares = await this.revenueShares.findPendingByBillingAccount(
      settlement.billingAccountId,
    );
    const settledIds = new Set(settlement.revenueShareIds);
    const toMarkPaid = allShares.filter((rs) => settledIds.has(rs.id));

    await Promise.all(
      toMarkPaid.map((rs) =>
        this.revenueShares.update({ ...rs, status: "paid", paidAt: now, updatedAt: now }),
      ),
    );

    await this.emitEvent({
      type: "settlement.completed",
      billingAccountId: settlement.billingAccountId,
      tenantId: settlement.tenantId,
      payload: { settlementId, totalAmount: settlement.totalAmount, externalReference },
    });

    return saved;
  }

  async failSettlement(settlementId: string, reason: string): Promise<Settlement> {
    const settlement = await this.settlements.findById(settlementId);
    if (!settlement) throw new Error(`settlement ${settlementId} not found`);
    if (settlement.status !== "pending") {
      throw new Error(`settlement is not in pending status`);
    }

    const now = new Date().toISOString();
    const updated: Settlement = {
      ...settlement,
      status: "failed",
      failedAt: now,
      failureReason: reason,
      updatedAt: now,
    };

    const saved = await this.settlements.update(updated);

    await this.emitEvent({
      type: "settlement.failed",
      billingAccountId: settlement.billingAccountId,
      tenantId: settlement.tenantId,
      payload: { settlementId, reason },
    });

    return saved;
  }

  async reconcile(
    billingAccountId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<ReconciliationReport> {
    const allShares = await this.revenueShares.findPendingByBillingAccount(billingAccountId);
    const allSettlements = await this.settlements.findByBillingAccountId(billingAccountId);

    const periodShares = allShares.filter(
      (rs) => rs.periodStart >= periodStart && rs.periodEnd <= periodEnd,
    );

    const periodSettlements = allSettlements.filter(
      (s) => s.scheduledAt >= periodStart && s.scheduledAt <= periodEnd,
    );

    const totalGross = periodShares.reduce((s, rs) => s + rs.grossAmount, 0);
    const totalFees = periodShares.reduce((s, rs) => s + rs.platformFeeAmount, 0);
    const totalNet = periodShares.reduce((s, rs) => s + rs.netAmount, 0);

    const settledAmount = periodSettlements
      .filter((s) => s.status === "completed")
      .reduce((s, settlement) => s + settlement.totalAmount, 0);

    const currency = periodShares[0]?.currency ?? "BRL";

    return {
      billingAccountId,
      periodStart,
      periodEnd,
      totalGross,
      totalFees,
      totalNet,
      settledAmount,
      pendingAmount: totalNet - settledAmount,
      currency,
      revenueShareCount: periodShares.length,
      settlementCount: periodSettlements.length,
    };
  }

  private async emitEvent(input: Omit<PaymentEvent, "id" | "occurredAt">): Promise<void> {
    const event: PaymentEvent = {
      ...input,
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    };
    await this.events.save(event);
  }
}
