import { describe, expect, it } from "vitest";
import {
  matchVehiclesForCapacity,
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
