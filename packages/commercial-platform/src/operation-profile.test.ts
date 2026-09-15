import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createOperationProfile,
  listOperationProfiles,
  getOperationProfile,
  setPrimaryOperationProfile,
  setOperationProfileStatus,
} from "./operation-profile.js";
import { createBusinessProfileVersion, confirmBusinessProfile } from "./business-profile.js";

// Same in-memory FakeDb shape as onboarding-foundation.test.ts.
interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private eqs: Array<{ c: string; v: unknown }> = [];
  private neqs: Array<{ c: string; v: unknown }> = [];
  private orderCol: string | null = null;
  private orderDesc = false;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(row: Row) {
    this.op = "update";
    this.payload = row;
    return this;
  }
  eq(c: string, v: unknown) {
    this.eqs.push({ c, v });
    return this;
  }
  neq(c: string, v: unknown) {
    this.neqs.push({ c, v });
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) {
    this.orderCol = c;
    this.orderDesc = o?.ascending === false;
    return this;
  }
  limit() {
    return this;
  }
  single() {
    return this.run("single");
  }
  maybeSingle() {
    return this.run("maybeSingle");
  }
  then(resolve: (v: unknown) => void) {
    resolve(this.run("list"));
  }

  private hit(r: Row): boolean {
    return this.eqs.every((f) => r[f.c] === f.v) && this.neqs.every((f) => r[f.c] !== f.v);
  }

  private run(mode: "single" | "maybeSingle" | "list") {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    if (this.op === "insert") {
      const row = { id: `${this.table}-${rows.length + 1}`, ...this.payload };
      rows.push(row);
      return Promise.resolve({ data: row, error: null });
    }
    if (this.op === "update") {
      const updated: Row[] = [];
      for (const r of rows) {
        if (this.hit(r)) {
          Object.assign(r, this.payload);
          updated.push(r);
        }
      }
      return Promise.resolve({ data: updated[0] ?? null, error: null });
    }
    let matched = rows.filter((r) => this.hit(r));
    if (this.orderCol) {
      matched = [...matched].sort((a, b) => {
        const av = String(a[this.orderCol!] ?? "");
        const bv = String(b[this.orderCol!] ?? "");
        return this.orderDesc ? bv.localeCompare(av) : av.localeCompare(bv);
      });
    }
    if (mode === "list") return Promise.resolve({ data: matched, error: null });
    const first = matched[0] ?? null;
    if (mode === "single" && !first)
      return Promise.resolve({ data: null, error: { message: "nf" } });
    return Promise.resolve({ data: first, error: null });
  }
}

class FakeDb {
  tables: Record<string, Row[]> = {};
  from(t: string) {
    return new FakeQuery(this, t);
  }
}
const makeDb = () => new FakeDb() as unknown as SupabaseClient;

describe("OBRIGATÓRIO #1 — single operation", () => {
  it("creates one operation profile for a tenant", async () => {
    const db = makeDb();
    const profile = await createOperationProfile(db, {
      tenantId: "t1",
      type: "vehicle_rental",
    });
    expect(profile.tenantId).toBe("t1");
    expect(profile.type).toBe("vehicle_rental");
    expect(profile.status).toBe("active");
    expect(profile.role).toBe("secondary");
    expect(profile.characteristics.kind).toBe("generic");
  });
});

describe("OBRIGATÓRIO #2 — multiple operations", () => {
  it("a tenant can run rental + towing + passenger transport simultaneously", async () => {
    const db = makeDb();
    await createOperationProfile(db, { tenantId: "t1", type: "vehicle_rental" });
    await createOperationProfile(db, { tenantId: "t1", type: "towing_service" });
    await createOperationProfile(db, { tenantId: "t1", type: "passenger_transport" });

    const profiles = await listOperationProfiles(db, "t1");
    expect(profiles).toHaveLength(3);
    expect(profiles.map((p) => p.type).sort()).toEqual(
      ["passenger_transport", "towing_service", "vehicle_rental"].sort(),
    );
  });

  it("never mixes operation profiles across tenants", async () => {
    const db = makeDb();
    await createOperationProfile(db, { tenantId: "t1", type: "vehicle_rental" });
    await createOperationProfile(db, { tenantId: "t2", type: "towing_service" });

    const t1Profiles = await listOperationProfiles(db, "t1");
    const t2Profiles = await listOperationProfiles(db, "t2");
    expect(t1Profiles).toHaveLength(1);
    expect(t2Profiles).toHaveLength(1);
    expect(t1Profiles[0].type).toBe("vehicle_rental");
    expect(t2Profiles[0].type).toBe("towing_service");
  });
});

describe("OBRIGATÓRIO #5 — primaryOperation", () => {
  it("setPrimaryOperationProfile promotes one profile and demotes the previous primary", async () => {
    const db = makeDb();
    const rental = await createOperationProfile(db, {
      tenantId: "t1",
      type: "vehicle_rental",
      role: "primary",
    });
    const towing = await createOperationProfile(db, { tenantId: "t1", type: "towing_service" });

    const promoted = await setPrimaryOperationProfile(db, "t1", towing.id);
    expect(promoted.role).toBe("primary");

    const rentalAfter = await getOperationProfile(db, "t1", rental.id);
    expect(rentalAfter?.role).toBe("secondary");
  });

  it("syncs the confirmed business profile's primaryOperationId", async () => {
    const db = makeDb();
    const bp = await createBusinessProfileVersion(db, {
      tenantId: "t1",
      primaryVertical: "rental-cars",
      source: "self_service",
      createdBy: "u1",
    });
    const confirmed = await confirmBusinessProfile(db, bp.id);
    expect(confirmed.primaryOperationId).toBeNull();

    const towing = await createOperationProfile(db, { tenantId: "t1", type: "towing_service" });
    await setPrimaryOperationProfile(db, "t1", towing.id);

    const { getConfirmedBusinessProfile } = await import("./business-profile.js");
    const refetched = await getConfirmedBusinessProfile(db, "t1");
    expect(refetched?.primaryOperationId).toBe(towing.id);
  });

  it("rejects promoting a suspended operation profile to primary", async () => {
    const db = makeDb();
    const towing = await createOperationProfile(db, { tenantId: "t1", type: "towing_service" });
    await setOperationProfileStatus(db, "t1", towing.id, "suspended");
    await expect(setPrimaryOperationProfile(db, "t1", towing.id)).rejects.toThrow();
  });
});

describe("OBRIGATÓRIO #6 — profile versioning (operation profile status lifecycle)", () => {
  it("suspends and reactivates an operation profile without touching others", async () => {
    const db = makeDb();
    const rental = await createOperationProfile(db, { tenantId: "t1", type: "vehicle_rental" });
    const towing = await createOperationProfile(db, { tenantId: "t1", type: "towing_service" });

    const suspended = await setOperationProfileStatus(db, "t1", towing.id, "suspended");
    expect(suspended.status).toBe("suspended");

    const rentalStill = await getOperationProfile(db, "t1", rental.id);
    expect(rentalStill?.status).toBe("active");

    const reactivated = await setOperationProfileStatus(db, "t1", towing.id, "active");
    expect(reactivated.status).toBe("active");
  });
});

describe("characteristics discriminated schemas", () => {
  it("defaults passenger_transport characteristics to its own shape", async () => {
    const db = makeDb();
    const profile = await createOperationProfile(db, {
      tenantId: "t1",
      type: "passenger_transport",
    });
    expect(profile.characteristics.kind).toBe("passenger_transport");
    if (profile.characteristics.kind === "passenger_transport") {
      expect(profile.characteristics.supportsOneWay).toBe(true);
      expect(profile.characteristics.serviceModels).toEqual([]);
    }
  });

  it("accepts an explicit, matching passenger_transport characteristics payload", async () => {
    const db = makeDb();
    const profile = await createOperationProfile(db, {
      tenantId: "t1",
      type: "passenger_transport",
      characteristics: {
        kind: "passenger_transport",
        version: 1,
        serviceModels: ["scheduled", "recurring"],
        purposes: ["corporate"],
        fleetTypes: ["bus", "van"],
        supportsOneWay: true,
        supportsRoundTrip: true,
        supportsRecurringRoutes: true,
      },
    });
    if (profile.characteristics.kind === "passenger_transport") {
      expect(profile.characteristics.serviceModels).toEqual(["scheduled", "recurring"]);
      expect(profile.characteristics.supportsRecurringRoutes).toBe(true);
    }
  });

  it("rejects a characteristics payload whose kind doesn't match the operation type", async () => {
    const db = makeDb();
    await expect(
      createOperationProfile(db, {
        tenantId: "t1",
        type: "towing_service",
        characteristics: {
          kind: "passenger_transport",
          version: 1,
          serviceModels: [],
          purposes: [],
          fleetTypes: [],
          supportsOneWay: true,
          supportsRoundTrip: true,
          supportsRecurringRoutes: false,
        },
      }),
    ).rejects.toThrow(/does not match operation type/);
  });

  it("defaults towing_service characteristics to serviceModel mixed", async () => {
    const db = makeDb();
    const profile = await createOperationProfile(db, { tenantId: "t1", type: "towing_service" });
    expect(profile.characteristics.kind).toBe("towing_service");
    if (profile.characteristics.kind === "towing_service") {
      expect(profile.characteristics.serviceModel).toBe("mixed");
    }
  });

  // water_tank_service / bulk_material_transport reuse towing's exact
  // service-dispatch kernel (same four DispatchServiceModel values).
  it("defaults water_tank_service characteristics to serviceModel mixed, capacityUnit liters", async () => {
    const db = makeDb();
    const profile = await createOperationProfile(db, {
      tenantId: "t1",
      type: "water_tank_service",
    });
    expect(profile.characteristics.kind).toBe("water_tank_service");
    if (profile.characteristics.kind === "water_tank_service") {
      expect(profile.characteristics.serviceModel).toBe("mixed");
      expect(profile.characteristics.capacityUnit).toBe("liters");
    }
  });

  it("defaults bulk_material_transport characteristics to serviceModel mixed, no material types yet", async () => {
    const db = makeDb();
    const profile = await createOperationProfile(db, {
      tenantId: "t1",
      type: "bulk_material_transport",
    });
    expect(profile.characteristics.kind).toBe("bulk_material_transport");
    if (profile.characteristics.kind === "bulk_material_transport") {
      expect(profile.characteristics.serviceModel).toBe("mixed");
      expect(profile.characteristics.materialTypes).toEqual([]);
      expect(profile.characteristics.capacityUnit).toBe("cubic_meters");
    }
  });

  it("accepts an explicit bulk_material_transport payload with real material types", async () => {
    const db = makeDb();
    const profile = await createOperationProfile(db, {
      tenantId: "t1",
      type: "bulk_material_transport",
      characteristics: {
        kind: "bulk_material_transport",
        version: 1,
        serviceModel: "commercial_towing_service",
        materialTypes: ["sand", "gravel"],
        capacityUnit: "tons",
      },
    });
    if (profile.characteristics.kind === "bulk_material_transport") {
      expect(profile.characteristics.materialTypes).toEqual(["sand", "gravel"]);
      expect(profile.characteristics.capacityUnit).toBe("tons");
    }
  });

  it("rejects a water_tank_service profile given bulk_material_transport characteristics", async () => {
    const db = makeDb();
    await expect(
      createOperationProfile(db, {
        tenantId: "t1",
        type: "water_tank_service",
        characteristics: {
          kind: "bulk_material_transport",
          version: 1,
          serviceModel: "mixed",
          materialTypes: [],
          capacityUnit: "tons",
        },
      }),
    ).rejects.toThrow(/does not match operation type/);
  });
});
