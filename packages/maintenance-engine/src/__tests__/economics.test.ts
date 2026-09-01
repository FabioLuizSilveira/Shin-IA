import { describe, it, expect } from "vitest";
import { computeAssetEconomics } from "../economics.js";

describe("computeAssetEconomics", () => {
  it("computes maintenance-cost-based metrics with no acquisition cost provided", () => {
    const result = computeAssetEconomics({
      totalMaintenanceCostCents: 100_000,
      acquisitionCostCents: null,
      ownershipDays: 100,
      odometer: 10_000,
      hourMeter: null,
    });
    expect(result.totalMaintenanceCostCents).toBe(100_000);
    expect(result.maintenanceCostPerDayCents).toBe(1_000);
    expect(result.maintenanceCostPerOdometerUnit).toBe(10);
    expect(result.maintenanceCostPerHourMeterUnit).toBeNull();
    expect(result.totalCostOfOwnershipCents).toBeNull();
    expect(result.maintenanceCostAsFractionOfAcquisition).toBeNull();
  });

  it("never invents an acquisition-based metric when acquisition cost is null", () => {
    const result = computeAssetEconomics({
      totalMaintenanceCostCents: 500_00,
      acquisitionCostCents: null,
      ownershipDays: 30,
      odometer: null,
      hourMeter: null,
    });
    expect(result.totalCostOfOwnershipCents).toBeNull();
    expect(result.maintenanceCostAsFractionOfAcquisition).toBeNull();
  });

  it("computes TCO and the maintenance fraction once acquisition cost is provided", () => {
    const result = computeAssetEconomics({
      totalMaintenanceCostCents: 20_000_00,
      acquisitionCostCents: 100_000_00,
      ownershipDays: 365,
      odometer: null,
      hourMeter: null,
    });
    expect(result.totalCostOfOwnershipCents).toBe(120_000_00);
    expect(result.maintenanceCostAsFractionOfAcquisition).toBe(0.2);
  });

  it("treats an acquisition cost of exactly 0 the same as null (never divides by zero)", () => {
    const result = computeAssetEconomics({
      totalMaintenanceCostCents: 10_000,
      acquisitionCostCents: 0,
      ownershipDays: 10,
      odometer: null,
      hourMeter: null,
    });
    expect(result.totalCostOfOwnershipCents).toBeNull();
    expect(result.maintenanceCostAsFractionOfAcquisition).toBeNull();
  });

  it("returns a null cost-per-day when ownership days is null or non-positive", () => {
    expect(
      computeAssetEconomics({
        totalMaintenanceCostCents: 1000,
        acquisitionCostCents: null,
        ownershipDays: null,
        odometer: null,
        hourMeter: null,
      }).maintenanceCostPerDayCents,
    ).toBeNull();

    expect(
      computeAssetEconomics({
        totalMaintenanceCostCents: 1000,
        acquisitionCostCents: null,
        ownershipDays: 0,
        odometer: null,
        hourMeter: null,
      }).maintenanceCostPerDayCents,
    ).toBeNull();
  });

  it("reuses costPerUnit's own null-on-missing-denominator behavior for odometer/hour meter", () => {
    const result = computeAssetEconomics({
      totalMaintenanceCostCents: 1000,
      acquisitionCostCents: null,
      ownershipDays: 10,
      odometer: 0,
      hourMeter: 0,
    });
    expect(result.maintenanceCostPerOdometerUnit).toBeNull();
    expect(result.maintenanceCostPerHourMeterUnit).toBeNull();
  });
});
