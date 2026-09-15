import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBusinessProfileVersion,
  confirmBusinessProfile,
  getConfirmedBusinessProfile,
} from "./business-profile.js";
import {
  createCommercialConfiguration,
  updateCommercialConfiguration,
  markCommercialConfigurationAccepted,
} from "./commercial-configuration.js";
import { resolveCurrentRetentionPolicy } from "./retention-policy.js";

// Extended in-memory fake — adds update()/neq() on top of the
// select/insert/eq/order/limit/single/maybeSingle chain acceptance.test.ts
// already models.
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
    return this.run(true);
  }
  maybeSingle() {
    return this.run(false);
  }
  then(resolve: (v: unknown) => void) {
    resolve(this.run(false));
  }

  private hit(r: Row): boolean {
    return this.eqs.every((f) => r[f.c] === f.v) && this.neqs.every((f) => r[f.c] !== f.v);
  }

  private run(strictSingle: boolean) {
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
        const av = a[this.orderCol!] as number;
        const bv = b[this.orderCol!] as number;
        return this.orderDesc ? bv - av : av - bv;
      });
    }
    const first = matched[0] ?? null;
    if (strictSingle && !first) return Promise.resolve({ data: null, error: { message: "nf" } });
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

describe("business_profiles — versioning + confirm supersede", () => {
  it("createBusinessProfileVersion bumps version per tenant, always as draft", async () => {
    const db = makeDb();
    const v1 = await createBusinessProfileVersion(db, {
      tenantId: "t1",
      primaryVertical: "rental-cars",
      source: "self_service",
      createdBy: "u1",
    });
    const v2 = await createBusinessProfileVersion(db, {
      tenantId: "t1",
      primaryVertical: "rental-cars",
      additionalVerticals: ["rental-motorcycles"],
      source: "self_service",
      createdBy: "u1",
    });
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(v1.status).toBe("draft");
    expect(v2.status).toBe("draft");
  });

  it("a separate tenant starts its own version sequence at 1", async () => {
    const db = makeDb();
    await createBusinessProfileVersion(db, {
      tenantId: "t1",
      primaryVertical: "rental-cars",
      source: "self_service",
      createdBy: "u1",
    });
    const other = await createBusinessProfileVersion(db, {
      tenantId: "t2",
      primaryVertical: "forklift",
      source: "self_service",
      createdBy: "u2",
    });
    expect(other.version).toBe(1);
    expect(other.tenantId).toBe("t2");
  });

  it("confirmBusinessProfile supersedes the tenant's previous confirmed version", async () => {
    const db = makeDb();
    const v1 = await createBusinessProfileVersion(db, {
      tenantId: "t1",
      primaryVertical: "rental-cars",
      source: "self_service",
      createdBy: "u1",
    });
    await confirmBusinessProfile(db, v1.id);
    const v2 = await createBusinessProfileVersion(db, {
      tenantId: "t1",
      primaryVertical: "rental-cars",
      source: "self_service",
      createdBy: "u1",
    });
    await confirmBusinessProfile(db, v2.id);

    const current = await getConfirmedBusinessProfile(db, "t1");
    expect(current?.id).toBe(v2.id);
    const rows = (db as unknown as FakeDb).tables.business_profiles;
    expect(rows.find((r) => r.id === v1.id)?.status).toBe("superseded");
  });

  it("refuses to confirm a superseded profile", async () => {
    const db = makeDb();
    const v1 = await createBusinessProfileVersion(db, {
      tenantId: "t1",
      primaryVertical: "rental-cars",
      source: "self_service",
      createdBy: "u1",
    });
    await confirmBusinessProfile(db, v1.id);
    const v2 = await createBusinessProfileVersion(db, {
      tenantId: "t1",
      primaryVertical: "rental-cars",
      source: "self_service",
      createdBy: "u1",
    });
    await confirmBusinessProfile(db, v2.id);
    await expect(confirmBusinessProfile(db, v1.id)).rejects.toThrow(/superseded/);
  });
});

describe("commercial_configurations — draft lifecycle", () => {
  it("an accepted configuration can no longer be edited", async () => {
    const db = makeDb();
    const cfg = await createCommercialConfiguration(db, {
      tenantId: "t1",
      source: "self_service",
      createdBy: "u1",
      quotas: { assets: 40 },
    });
    await markCommercialConfigurationAccepted(db, cfg.id, "snap-1");
    await expect(
      updateCommercialConfiguration(db, cfg.id, { quotas: { assets: 999 } }),
    ).rejects.toThrow(/accepted/);
  });

  it("a draft configuration can be re-priced", async () => {
    const db = makeDb();
    const cfg = await createCommercialConfiguration(db, {
      tenantId: "t1",
      source: "self_service",
      createdBy: "u1",
    });
    const updated = await updateCommercialConfiguration(db, cfg.id, {
      prices: { monthlyCents: 59900 },
      pricingVersion: 3,
    });
    expect((updated.prices as { monthlyCents: number }).monthlyCents).toBe(59900);
    expect(updated.pricingVersion).toBe(3);
  });

  // WAVE 4 — Multi-Operation Business Architecture v2: per-operation line
  // items (spec section 31's operationConfigurations), descriptive only —
  // no per-operation pricing model exists yet.
  it("round-trips operationConfigurations for a multi-operation tenant", async () => {
    const db = makeDb();
    const cfg = await createCommercialConfiguration(db, {
      tenantId: "t1",
      source: "self_service",
      createdBy: "u1",
      operationConfigurations: [
        { operationType: "vehicle_rental", assetQuantity: 42 },
        { operationType: "towing_service", assetQuantity: 3 },
        { operationType: "passenger_transport", assetQuantity: 8 },
      ],
    });
    expect(cfg.operationConfigurations).toHaveLength(3);
    expect(cfg.operationConfigurations[1]).toEqual({
      operationType: "towing_service",
      assetQuantity: 3,
    });

    const updated = await updateCommercialConfiguration(db, cfg.id, {
      operationConfigurations: [{ operationType: "vehicle_rental", assetQuantity: 45 }],
    });
    expect(updated.operationConfigurations).toEqual([
      { operationType: "vehicle_rental", assetQuantity: 45 },
    ]);
  });

  it("defaults operationConfigurations to an empty array for a single-operation tenant", async () => {
    const db = makeDb();
    const cfg = await createCommercialConfiguration(db, {
      tenantId: "t1",
      source: "self_service",
      createdBy: "u1",
    });
    expect(cfg.operationConfigurations).toEqual([]);
  });
});

describe("retention_policies", () => {
  it("resolveCurrentRetentionPolicy returns the highest published version", async () => {
    const db = makeDb();
    const fake = db as unknown as FakeDb;
    fake.tables.retention_policies = [
      { id: "rp1", version: 1, name: "v1", rules: [], status: "published" },
      {
        id: "rp2",
        version: 2,
        name: "v2",
        rules: [{ dataCategory: "contracts" }],
        status: "published",
      },
      { id: "rp3", version: 3, name: "v3-draft", rules: [], status: "draft" },
    ];
    const current = await resolveCurrentRetentionPolicy(db);
    expect(current.version).toBe(2);
  });

  it("throws when no published policy exists", async () => {
    const db = makeDb();
    (db as unknown as FakeDb).tables.retention_policies = [
      { id: "rp1", version: 1, name: "draft only", rules: [], status: "draft" },
    ];
    await expect(resolveCurrentRetentionPolicy(db)).rejects.toThrow(/no published/);
  });
});
