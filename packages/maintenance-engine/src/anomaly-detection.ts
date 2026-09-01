import type { MaintenanceOrderType } from "./types.js";
import { downtimeHours } from "./cost.js";

// Anomaly Detection (Etapa 6, P1) — rule/statistics-based, deterministic,
// no LLM/ML. Same "never invent, never present false precision"
// discipline as resolvePlanDue()/computeAssetHealthScore(): a statistical
// check only ever fires once there is enough same-type sample history to
// make "outlier" a meaningful word (MIN_SAMPLE_SIZE) -- with fewer data
// points the check is skipped for that asset entirely, never approximated
// against a smaller or unrelated population.
//
// Outlier detection uses median + MAD (median absolute deviation), not
// mean/stddev: with the small samples typical of one asset's history, a
// single extreme value inflates the mean and stddev enough to mask
// itself (the "masking effect" -- verified while writing this module's
// tests: a 20x-cost order among 3 normal ones failed to clear even a
// 2-sigma mean/stddev threshold). Median and MAD have a much higher
// breakdown point, so a real outlier still reads as one.

export type AnomalyType =
  | "cost_outlier"
  | "downtime_outlier"
  | "recurring_component"
  | "odometer_regression"
  | "high_corrective_ratio";

export type AnomalySeverity = "low" | "medium" | "high";

export interface MaintenanceAnomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  orderId: string | null;
  relatedOrderId: string | null;
}

export interface AnomalyOrderInput {
  id: string;
  type: MaintenanceOrderType;
  openedAt: string;
  totalCostCents: number;
  downtimeStart: string | null;
  downtimeEnd: string | null;
  odometer: number | null;
  items: { component: string }[];
}

const MIN_SAMPLE_SIZE = 3;
// Iglewicz & Hoaglin's standard modified z-score threshold/constant for
// median+MAD outlier detection.
const MODIFIED_Z_THRESHOLD = 3.5;
const MODIFIED_Z_HIGH_SEVERITY_THRESHOLD = 7; // double the flag threshold
const MAD_CONSTANT = 0.6745;

const RECURRING_COMPONENT_HIGH_SEVERITY_DAYS = 14;
const RECURRING_COMPONENT_WINDOW_DAYS = 60;

const HIGH_CORRECTIVE_RATIO_MIN_ORDERS = 5;
const HIGH_CORRECTIVE_RATIO_THRESHOLD = 0.6;

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function detectStatisticalOutliers(
  orders: AnomalyOrderInput[],
  getValue: (o: AnomalyOrderInput) => number | null,
  build: (o: AnomalyOrderInput, med: number, modifiedZ: number) => MaintenanceAnomaly,
): MaintenanceAnomaly[] {
  const anomalies: MaintenanceAnomaly[] = [];

  const byType = new Map<MaintenanceOrderType, { order: AnomalyOrderInput; value: number }[]>();
  for (const order of orders) {
    const value = getValue(order);
    if (value === null) continue;
    const list = byType.get(order.type) ?? [];
    list.push({ order, value });
    byType.set(order.type, list);
  }

  for (const entries of byType.values()) {
    if (entries.length < MIN_SAMPLE_SIZE) continue; // never invent a baseline from too little data
    const values = entries.map((e) => e.value);
    const med = median([...values].sort((a, b) => a - b));
    const absDeviations = values.map((v) => Math.abs(v - med));
    const mad = median([...absDeviations].sort((a, b) => a - b));
    if (mad === 0) continue; // no baseline variance to judge against -- never invent significance

    for (const { order, value } of entries) {
      const modifiedZ = (MAD_CONSTANT * (value - med)) / mad;
      // Only the "unusually high" direction is a maintenance concern here
      // (an unusually cheap/short order isn't the anomaly this rule is
      // for) -- so this deliberately doesn't take Math.abs(modifiedZ).
      if (modifiedZ > MODIFIED_Z_THRESHOLD) {
        anomalies.push(build(order, med, modifiedZ));
      }
    }
  }

  return anomalies;
}

export function detectAssetAnomalies(orders: AnomalyOrderInput[]): MaintenanceAnomaly[] {
  const anomalies: MaintenanceAnomaly[] = [];

  // ── A. Cost outlier: same order type, statistically unusual total cost ──
  anomalies.push(
    ...detectStatisticalOutliers(
      orders,
      (o) => o.totalCostCents,
      (order, med, modifiedZ) => ({
        type: "cost_outlier",
        severity: modifiedZ > MODIFIED_Z_HIGH_SEVERITY_THRESHOLD ? "high" : "medium",
        message: `Custo de R$ ${(order.totalCostCents / 100).toFixed(2)} muito acima da mediana de ordens do tipo "${order.type}" (R$ ${(med / 100).toFixed(2)})`,
        orderId: order.id,
        relatedOrderId: null,
      }),
    ),
  );

  // ── B. Downtime outlier: same order type, statistically unusual downtime ──
  anomalies.push(
    ...detectStatisticalOutliers(
      orders,
      (o) => downtimeHours(o.downtimeStart, o.downtimeEnd),
      (order, med, modifiedZ) => ({
        type: "downtime_outlier",
        severity: modifiedZ > MODIFIED_Z_HIGH_SEVERITY_THRESHOLD ? "high" : "medium",
        message: `Tempo parado de ${(downtimeHours(order.downtimeStart, order.downtimeEnd) ?? 0).toFixed(1)}h muito acima da mediana de ordens do tipo "${order.type}" (${med.toFixed(1)}h)`,
        orderId: order.id,
        relatedOrderId: null,
      }),
    ),
  );

  const sortedByDate = [...orders].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
  );

  // ── C. Odometer regression: a later order recorded a smaller odometer
  // than an earlier one for the same asset -- data-entry error or possible
  // tampering, never a false positive on missing readings (nulls skipped).
  let lastOdometerOrder: AnomalyOrderInput | null = null;
  for (const order of sortedByDate) {
    if (order.odometer === null) continue;
    if (lastOdometerOrder && order.odometer < lastOdometerOrder.odometer!) {
      anomalies.push({
        type: "odometer_regression",
        severity: "high",
        message: `Odômetro registrado (${order.odometer}) é menor que o de uma ordem anterior (${lastOdometerOrder.odometer}) -- possível erro de digitação`,
        orderId: order.id,
        relatedOrderId: lastOdometerOrder.id,
      });
    }
    lastOdometerOrder = order;
  }

  // ── D. Recurring component in a short window -- same part serviced
  // again soon after, suggesting the root cause wasn't actually fixed.
  const byComponent = new Map<string, { order: AnomalyOrderInput; openedAt: Date }[]>();
  for (const order of sortedByDate) {
    for (const item of order.items) {
      const list = byComponent.get(item.component) ?? [];
      list.push({ order, openedAt: new Date(order.openedAt) });
      byComponent.set(item.component, list);
    }
  }
  for (const [component, entries] of byComponent) {
    for (let i = 1; i < entries.length; i++) {
      const gapDays =
        (entries[i].openedAt.getTime() - entries[i - 1].openedAt.getTime()) / 86_400_000;
      if (gapDays <= RECURRING_COMPONENT_WINDOW_DAYS) {
        anomalies.push({
          type: "recurring_component",
          severity: gapDays <= RECURRING_COMPONENT_HIGH_SEVERITY_DAYS ? "high" : "medium",
          message: `Componente "${component}" reincidiu ${Math.round(gapDays)} dia(s) após o último serviço`,
          orderId: entries[i].order.id,
          relatedOrderId: entries[i - 1].order.id,
        });
      }
    }
  }

  // ── E. High corrective/emergency ratio -- asset-level signal, not tied
  // to a single order, only raised with enough orders to be meaningful.
  if (orders.length >= HIGH_CORRECTIVE_RATIO_MIN_ORDERS) {
    const correctiveCount = orders.filter(
      (o) => o.type === "corrective" || o.type === "emergency",
    ).length;
    const ratio = correctiveCount / orders.length;
    if (ratio >= HIGH_CORRECTIVE_RATIO_THRESHOLD) {
      anomalies.push({
        type: "high_corrective_ratio",
        severity: ratio >= 0.8 ? "high" : "medium",
        message: `${Math.round(ratio * 100)}% das ordens são corretivas/emergenciais (${correctiveCount} de ${orders.length}) -- possível manutenção preventiva insuficiente`,
        orderId: null,
        relatedOrderId: null,
      });
    }
  }

  return anomalies;
}
