import type { KpiType, KpiValue } from "./types.js";

export interface KpiDataProvider {
  fetchMetric(
    tenantId: string,
    kpiType: KpiType,
    period: { start: string; end: string },
  ): Promise<{ value: number; previousValue: number | null }>;
}

export class KpiEngine {
  constructor(private dataProvider: KpiDataProvider) {}

  async compute(
    tenantId: string,
    kpiType: KpiType,
    period: { start: string; end: string },
  ): Promise<KpiValue> {
    const { value, previousValue } = await this.dataProvider.fetchMetric(tenantId, kpiType, period);

    const changePercent =
      previousValue !== null && previousValue !== 0
        ? ((value - previousValue) / previousValue) * 100
        : null;

    return {
      type: kpiType,
      label: this.labelFor(kpiType),
      value,
      unit: this.unitFor(kpiType),
      previousValue,
      changePercent: changePercent !== null ? Math.round(changePercent * 100) / 100 : null,
      period: `${period.start}/${period.end}`,
      computedAt: new Date().toISOString(),
    };
  }

  async computeAll(tenantId: string, period: { start: string; end: string }): Promise<KpiValue[]> {
    const types: KpiType[] = [
      "operations",
      "assets",
      "revenue",
      "commissions",
      "utilization",
      "tracking",
      "infractions",
    ];
    return Promise.all(types.map((t) => this.compute(tenantId, t, period)));
  }

  private labelFor(type: KpiType): string {
    const labels: Record<KpiType, string> = {
      operations: "Total Operations",
      assets: "Active Assets",
      revenue: "Total Revenue",
      commissions: "Total Commissions",
      utilization: "Fleet Utilization",
      tracking: "Tracked Vehicles",
      infractions: "Infrações Recebidas",
    };
    return labels[type];
  }

  private unitFor(type: KpiType): string {
    const units: Record<KpiType, string> = {
      operations: "count",
      assets: "count",
      revenue: "BRL",
      commissions: "BRL",
      utilization: "%",
      tracking: "count",
      infractions: "count",
    };
    return units[type];
  }
}
