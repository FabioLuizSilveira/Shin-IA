import { describe, it, expect } from "vitest";
import { detectAssetAnomalies, type AnomalyOrderInput } from "../anomaly-detection.js";

function order(overrides: Partial<AnomalyOrderInput> = {}): AnomalyOrderInput {
  return {
    id: crypto.randomUUID(),
    type: "corrective",
    openedAt: "2026-06-01T00:00:00Z",
    totalCostCents: 10000,
    downtimeStart: null,
    downtimeEnd: null,
    odometer: null,
    items: [],
    ...overrides,
  };
}

describe("detectAssetAnomalies", () => {
  it("flags nothing for an empty history", () => {
    expect(detectAssetAnomalies([])).toEqual([]);
  });

  it("never flags a cost outlier with fewer than 3 same-type orders (never invents a baseline)", () => {
    const orders = [
      order({ totalCostCents: 10000 }),
      order({ totalCostCents: 1_000_000 }), // would be a huge outlier, but sample too small
    ];
    expect(detectAssetAnomalies(orders).filter((a) => a.type === "cost_outlier")).toEqual([]);
  });

  it("flags a cost outlier once there are >= 3 same-type orders and one is far above the mean", () => {
    const orders = [
      order({ totalCostCents: 10000 }),
      order({ totalCostCents: 11000 }),
      order({ totalCostCents: 9500 }),
      order({ totalCostCents: 200000, id: "outlier" }),
    ];
    const anomalies = detectAssetAnomalies(orders).filter((a) => a.type === "cost_outlier");
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].orderId).toBe("outlier");
    expect(anomalies[0].severity).toBe("high");
  });

  it("never flags a cost outlier when there is no variance in the sample", () => {
    const orders = [
      order({ totalCostCents: 10000 }),
      order({ totalCostCents: 10000 }),
      order({ totalCostCents: 10000 }),
      order({ totalCostCents: 10000 }),
    ];
    expect(detectAssetAnomalies(orders).filter((a) => a.type === "cost_outlier")).toEqual([]);
  });

  it("keeps cost baselines separate per order type", () => {
    // Corrective orders cluster around 10k; a single preventive order at 10k
    // must never be flagged just because it differs from the corrective set.
    const orders = [
      order({ type: "corrective", totalCostCents: 10000 }),
      order({ type: "corrective", totalCostCents: 10500 }),
      order({ type: "corrective", totalCostCents: 9800 }),
      order({ type: "preventive", totalCostCents: 500 }),
    ];
    expect(detectAssetAnomalies(orders).filter((a) => a.type === "cost_outlier")).toEqual([]);
  });

  it("flags a downtime outlier the same way, reusing the cost/type baseline logic", () => {
    const orders = [
      order({ downtimeStart: "2026-01-01T00:00:00Z", downtimeEnd: "2026-01-01T04:00:00Z" }), // 4h
      order({ downtimeStart: "2026-01-02T00:00:00Z", downtimeEnd: "2026-01-02T05:00:00Z" }), // 5h
      order({ downtimeStart: "2026-01-03T00:00:00Z", downtimeEnd: "2026-01-03T03:00:00Z" }), // 3h
      order({
        id: "long-downtime",
        downtimeStart: "2026-01-04T00:00:00Z",
        downtimeEnd: "2026-01-10T00:00:00Z", // 144h
      }),
    ];
    const anomalies = detectAssetAnomalies(orders).filter((a) => a.type === "downtime_outlier");
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].orderId).toBe("long-downtime");
  });

  it("flags an odometer regression against the previous chronological order", () => {
    const orders = [
      order({ id: "first", openedAt: "2026-01-01T00:00:00Z", odometer: 50000 }),
      order({ id: "second", openedAt: "2026-02-01T00:00:00Z", odometer: 48000 }), // went down
    ];
    const anomalies = detectAssetAnomalies(orders).filter((a) => a.type === "odometer_regression");
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].orderId).toBe("second");
    expect(anomalies[0].relatedOrderId).toBe("first");
  });

  it("never flags an odometer regression when readings only increase or are missing", () => {
    const orders = [
      order({ openedAt: "2026-01-01T00:00:00Z", odometer: 50000 }),
      order({ openedAt: "2026-02-01T00:00:00Z", odometer: null }),
      order({ openedAt: "2026-03-01T00:00:00Z", odometer: 52000 }),
    ];
    expect(detectAssetAnomalies(orders).filter((a) => a.type === "odometer_regression")).toEqual(
      [],
    );
  });

  it("flags a recurring component serviced again within the 60-day window", () => {
    const orders = [
      order({ id: "a", openedAt: "2026-01-01T00:00:00Z", items: [{ component: "Correia" }] }),
      order({ id: "b", openedAt: "2026-01-20T00:00:00Z", items: [{ component: "Correia" }] }), // 19 days later
    ];
    const anomalies = detectAssetAnomalies(orders).filter((a) => a.type === "recurring_component");
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].orderId).toBe("b");
    expect(anomalies[0].relatedOrderId).toBe("a");
    expect(anomalies[0].severity).toBe("medium"); // 19 days is past the <=14-day "high" cutoff
  });

  it("severity is high within 14 days, medium between 15 and 60 days", () => {
    const soon = [
      order({ id: "a", openedAt: "2026-01-01T00:00:00Z", items: [{ component: "Correia" }] }),
      order({ id: "b", openedAt: "2026-01-10T00:00:00Z", items: [{ component: "Correia" }] }),
    ];
    expect(detectAssetAnomalies(soon)[0].severity).toBe("high");

    const later = [
      order({ id: "a", openedAt: "2026-01-01T00:00:00Z", items: [{ component: "Correia" }] }),
      order({ id: "b", openedAt: "2026-02-01T00:00:00Z", items: [{ component: "Correia" }] }), // 31 days
    ];
    expect(detectAssetAnomalies(later)[0].severity).toBe("medium");
  });

  it("never flags a recurring component serviced again after the 60-day window", () => {
    const orders = [
      order({ openedAt: "2026-01-01T00:00:00Z", items: [{ component: "Correia" }] }),
      order({ openedAt: "2026-06-01T00:00:00Z", items: [{ component: "Correia" }] }), // ~150 days
    ];
    expect(detectAssetAnomalies(orders).filter((a) => a.type === "recurring_component")).toEqual(
      [],
    );
  });

  it("flags a high corrective ratio only with enough orders to be meaningful", () => {
    const fewOrders = [order({ type: "corrective" }), order({ type: "corrective" })];
    expect(
      detectAssetAnomalies(fewOrders).filter((a) => a.type === "high_corrective_ratio"),
    ).toEqual([]);

    const manyCorrective = [
      order({ type: "corrective" }),
      order({ type: "corrective" }),
      order({ type: "corrective" }),
      order({ type: "corrective" }),
      order({ type: "preventive" }),
    ];
    const anomalies = detectAssetAnomalies(manyCorrective).filter(
      (a) => a.type === "high_corrective_ratio",
    );
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].orderId).toBeNull(); // asset-level signal, not tied to one order
  });

  it("never flags a high corrective ratio when preventive maintenance dominates", () => {
    const orders = [
      order({ type: "preventive" }),
      order({ type: "preventive" }),
      order({ type: "preventive" }),
      order({ type: "preventive" }),
      order({ type: "corrective" }),
    ];
    expect(detectAssetAnomalies(orders).filter((a) => a.type === "high_corrective_ratio")).toEqual(
      [],
    );
  });
});
