import { describe, expect, it } from "vitest";
import {
  matchVehiclesForCapacity,
  matchVehiclesByCapacityField,
  matchAvailableVehiclesByFleetType,
  matchDriversForFleetType,
  type AssetForMatching,
  type ResourceForMatching,
} from "./resource-matching";

describe("matchVehiclesForCapacity", () => {
  const assets: AssetForMatching[] = [
    { id: "a1", status: "available", metadata: { seatCapacity: 50 } },
    { id: "a2", status: "available", metadata: { seatCapacity: 20 } },
    { id: "a3", status: "maintenance", metadata: { seatCapacity: 52 } },
    { id: "a4", status: "available", metadata: {} }, // no capacity recorded
  ];

  it("only returns available vehicles with enough seats", () => {
    const matched = matchVehiclesForCapacity(assets, 46);
    expect(matched.map((a) => a.id)).toEqual(["a1"]);
  });

  it("never matches a vehicle under maintenance even if capacity fits", () => {
    const matched = matchVehiclesForCapacity(assets, 40);
    expect(matched.map((a) => a.id)).not.toContain("a3");
  });

  it("never matches a vehicle with no recorded capacity — never guesses", () => {
    const matched = matchVehiclesForCapacity(assets, 1);
    expect(matched.map((a) => a.id)).not.toContain("a4");
  });
});

// water_tank_service / bulk_material_transport reuse the same matching
// kernel via a generic capacity field instead of a hardcoded one.
describe("matchVehiclesByCapacityField", () => {
  const waterTrucks: AssetForMatching[] = [
    { id: "w1", status: "available", metadata: { capacityLiters: 10000 } },
    { id: "w2", status: "available", metadata: { capacityLiters: 5000 } },
    { id: "w3", status: "maintenance", metadata: { capacityLiters: 12000 } },
    { id: "w4", status: "available", metadata: {} },
  ];

  it("matches available water tank trucks with enough liters", () => {
    const matched = matchVehiclesByCapacityField(waterTrucks, "capacityLiters", 8000);
    expect(matched.map((a) => a.id)).toEqual(["w1"]);
  });

  it("never matches a truck under maintenance even if capacity fits", () => {
    const matched = matchVehiclesByCapacityField(waterTrucks, "capacityLiters", 8000);
    expect(matched.map((a) => a.id)).not.toContain("w3");
  });

  it("never matches a truck with no recorded capacity — never guesses", () => {
    const matched = matchVehiclesByCapacityField(waterTrucks, "capacityLiters", 1);
    expect(matched.map((a) => a.id)).not.toContain("w4");
  });

  it("works identically for bulk material trucks via capacityCubicMeters/capacityTons", () => {
    const bulkTrucks: AssetForMatching[] = [
      { id: "b1", status: "available", metadata: { capacityCubicMeters: 12 } },
      { id: "b2", status: "available", metadata: { capacityCubicMeters: 6 } },
      { id: "b3", status: "available", metadata: { capacityTons: 20 } },
    ];
    expect(
      matchVehiclesByCapacityField(bulkTrucks, "capacityCubicMeters", 10).map((a) => a.id),
    ).toEqual(["b1"]);
    expect(matchVehiclesByCapacityField(bulkTrucks, "capacityTons", 15).map((a) => a.id)).toEqual([
      "b3",
    ]);
  });
});

// Towing's own dispatch runtime — matching by fleet type, not capacity.
describe("matchAvailableVehiclesByFleetType", () => {
  const assets: AssetForMatching[] = [
    { id: "t1", status: "available", metadata: { fleetType: "tow_truck" } },
    { id: "t2", status: "busy", metadata: { fleetType: "tow_truck" } },
    { id: "t3", status: "available", metadata: { fleetType: "van" } },
    { id: "t4", status: "available", metadata: {} }, // untagged
  ];

  it("matches only available vehicles tagged with the requested fleet type", () => {
    const matched = matchAvailableVehiclesByFleetType(assets, "tow_truck");
    expect(matched.map((a) => a.id)).toEqual(["t1"]);
  });

  it("never matches an unavailable tow truck", () => {
    const matched = matchAvailableVehiclesByFleetType(assets, "tow_truck");
    expect(matched.map((a) => a.id)).not.toContain("t2");
  });

  it("never matches an untagged vehicle — the opposite default from driver matching, since a multi-operation tenant has plenty of available vehicles of the wrong kind", () => {
    const matched = matchAvailableVehiclesByFleetType(assets, "tow_truck");
    expect(matched.map((a) => a.id)).not.toContain("t4");
  });
});

describe("matchDriversForFleetType", () => {
  const resources: ResourceForMatching[] = [
    {
      id: "r1",
      type: "driver",
      status: "available",
      metadata: { canOperateFleetTypes: ["bus", "van"] },
    },
    { id: "r2", type: "driver", status: "available", metadata: { canOperateFleetTypes: ["van"] } },
    { id: "r3", type: "driver", status: "busy", metadata: { canOperateFleetTypes: ["bus"] } },
    { id: "r4", type: "driver", status: "available", metadata: {} }, // no restriction recorded
    { id: "r5", type: "human", status: "available", metadata: {} }, // not a driver
  ];

  it("matches only available drivers whose declared fleet types include the requested one", () => {
    const matched = matchDriversForFleetType(resources, "bus");
    expect(matched.map((r) => r.id).sort()).toEqual(["r1", "r4"]);
  });

  it("never matches a busy driver", () => {
    const matched = matchDriversForFleetType(resources, "bus");
    expect(matched.map((r) => r.id)).not.toContain("r3");
  });

  it("never matches a non-driver resource", () => {
    const matched = matchDriversForFleetType(resources, "bus");
    expect(matched.map((r) => r.id)).not.toContain("r5");
  });

  it("treats a driver with no declared fleet types as unrestricted", () => {
    const matched = matchDriversForFleetType(resources, "van");
    expect(matched.map((r) => r.id)).toContain("r4");
  });

  it("with no fleetType filter, returns every available driver regardless of declared types", () => {
    const matched = matchDriversForFleetType(resources, undefined);
    expect(matched.map((r) => r.id).sort()).toEqual(["r1", "r2", "r4"]);
  });
});
