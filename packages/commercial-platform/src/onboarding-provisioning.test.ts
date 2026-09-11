import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashContent } from "./hash.js";
import {
  checkProvisioningReadiness,
  resolveProvisioningPlan,
  createProvisioningRun,
} from "./provisioning.js";

interface Row {
  [k: string]: unknown;
}
class FakeQuery {
  private op: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private filters: Array<(r: Row) => boolean> = [];
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
    this.filters.push((r) => r[c] === v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  private rows() {
    return (this.db.tables[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)));
  }
  maybeSingle() {
    if (this.op === "insert") return this.single();
    if (this.op === "update") {
      for (const r of this.rows()) Object.assign(r, this.payload);
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: this.rows()[0] ?? null, error: null });
  }
  single(): Promise<{ data: Row | null; error: { code?: string; message?: string } | null }> {
    if (this.op === "insert") {
      if (this.db.rejectInsert[this.table]) {
        return Promise.resolve({ data: null, error: { code: "23505" } });
      }
      const row = {
        id: `${this.table}-${(this.db.tables[this.table]?.length ?? 0) + 1}`,
        ...this.payload,
      };
      (this.db.tables[this.table] ??= []).push(row);
      return Promise.resolve({ data: row, error: null });
    }
    const first = this.rows()[0];
    return Promise.resolve(
      first ? { data: first, error: null } : { data: null, error: { message: "nf" } },
    );
  }
  then(resolve: (v: unknown) => void) {
    if (this.op === "update") {
      for (const r of this.rows()) Object.assign(r, this.payload);
      resolve({ data: null, error: null });
      return;
    }
    resolve({ data: this.rows(), error: null });
  }
}
class FakeDb {
  tables: Record<string, Row[]> = {};
  rejectInsert: Record<string, boolean> = {};
  from(t: string) {
    return new FakeQuery(this, t);
  }
}
const asClient = (db: FakeDb) => db as unknown as SupabaseClient;

async function seed(mode: "click_accept" | "electronic_signature") {
  const db = new FakeDb();
  const content = "Contrato completo.";
  db.tables.onboarding_contract_snapshots = [
    {
      id: "snap1",
      tenant_id: "t1",
      commercial_configuration_id: "cfg1",
      contract_version_id: "cv1",
      execution_mode: mode,
      composed_content: content,
      content_hash: await hashContent(content),
      status: "frozen",
    },
  ];
  db.tables.contract_templates = [{ id: "tpl1", product: "platform" }];
  db.tables.contract_versions = [
    { id: "cv1", contract_template_id: "tpl1", status: "published", version: 2 },
  ];
  db.tables.contract_acceptances = [];
  db.tables.signature_requests = [];
  db.tables.commercial_configurations = [
    {
      id: "cfg1",
      tenant_id: "t1",
      plan_id: "p1",
      plan_version_id: "pv1",
      extensions: ["tracking"],
      quotas: { assets: 50 },
      business_profile_id: "bp1",
    },
  ];
  db.tables.business_profiles = [
    { id: "bp1", primary_vertical: "rental-cars", additional_verticals: [] },
  ];
  db.tables.verticals = [{ key: "rental-cars", blueprint_id: "rental-cars" }];
  db.tables.onboarding_provisioning_runs = [];
  return db;
}

describe("WAVE 4 — provisioning gate", () => {
  it("not ready when the contract is only frozen, not accepted", async () => {
    const db = await seed("click_accept");
    const r = await checkProvisioningReadiness(asClient(db), {
      tenantId: "t1",
      commercialConfigurationId: "cfg1",
    });
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/not yet accepted/);
  });

  it("ready once a matching acceptance exists", async () => {
    const db = await seed("click_accept");
    db.tables.contract_acceptances.push({
      id: "acc1",
      tenant_id: "t1",
      product: "platform",
      contract_version_id: "cv1",
    });
    const r = await checkProvisioningReadiness(asClient(db), {
      tenantId: "t1",
      commercialConfigurationId: "cfg1",
    });
    expect(r.ready).toBe(true);
    expect(r.executionMode).toBe("click_accept");
  });

  it("signature mode needs a signed signature_request", async () => {
    const db = await seed("electronic_signature");
    let r = await checkProvisioningReadiness(asClient(db), {
      tenantId: "t1",
      commercialConfigurationId: "cfg1",
    });
    expect(r.ready).toBe(false);
    db.tables.signature_requests.push({
      id: "sr1",
      tenant_id: "t1",
      contract_version_id: "cv1",
      status: "signed",
    });
    r = await checkProvisioningReadiness(asClient(db), {
      tenantId: "t1",
      commercialConfigurationId: "cfg1",
    });
    expect(r.ready).toBe(true);
  });

  it("fails closed on a hash mismatch (hash-mismatch-ignored STOP)", async () => {
    const db = await seed("click_accept");
    db.tables.onboarding_contract_snapshots[0].content_hash = "deadbeef";
    const r = await checkProvisioningReadiness(asClient(db), {
      tenantId: "t1",
      commercialConfigurationId: "cfg1",
    });
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/hash mismatch/);
  });

  it("cross-tenant: another tenant's config is invisible", async () => {
    const db = await seed("click_accept");
    const r = await checkProvisioningReadiness(asClient(db), {
      tenantId: "t2",
      commercialConfigurationId: "cfg1",
    });
    expect(r.ready).toBe(false);
    expect(r.reason).toMatch(/no frozen contract snapshot/);
  });
});

describe("WAVE 4 — provisioning plan + run log", () => {
  it("resolves blueprints from the business profile's verticals", async () => {
    const db = await seed("click_accept");
    const plan = await resolveProvisioningPlan(asClient(db), {
      tenantId: "t1",
      commercialConfigurationId: "cfg1",
    });
    expect(plan.blueprintIds).toEqual(["rental-cars"]);
    expect(plan.featureFlags).toContain("ext.tracking");
    expect(plan.featureFlags).toContain("blueprint.rental-cars");
    expect(plan.quotas.assets).toBe(50);
  });

  it("createProvisioningRun refuses a second active run for the same snapshot", async () => {
    const db = await seed("click_accept");
    await createProvisioningRun(asClient(db), {
      tenantId: "t1",
      onboardingContractSnapshotId: "snap1",
      commercialConfigurationId: "cfg1",
      createdBy: "u1",
    });
    // FakeDb has no partial-unique index; simulate the 23505 the DB raises
    db.rejectInsert.onboarding_provisioning_runs = true;
    await expect(
      createProvisioningRun(asClient(db), {
        tenantId: "t1",
        onboardingContractSnapshotId: "snap1",
        commercialConfigurationId: "cfg1",
        createdBy: "u1",
      }),
    ).rejects.toThrow(/already exists/);
  });
});
