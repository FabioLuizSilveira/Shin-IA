import { describe, expect, it, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TenantContractRequirementResolver,
  NoContractMappingError,
} from "./requirement-resolver.js";

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private op: "select" | "insert" = "select";
  private row: Row = {};
  private filters: Array<{ col: string; val: unknown }> = [];
  private orderCol: string | null = null;
  private orderDesc = false;
  private embedClauses = false;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select(cols?: string) {
    if (cols?.includes("tenant_contract_clauses(")) this.embedClauses = true;
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.row = row;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ col, val });
    return this;
  }
  is(col: string, val: null) {
    this.filters.push({ col, val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderDesc = opts?.ascending === false;
    return this;
  }
  limit(_n: number) {
    return this;
  }
  single() {
    return this.execute(true);
  }
  maybeSingle() {
    return this.execute(true);
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => row[f.col] === f.val);
  }

  private execute(wantSingle: boolean) {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);

    if (this.op === "insert") {
      const id = (this.row.id as string) ?? `${this.table}-${rows.length + 1}`;
      const newRow = { ...this.row, id };
      rows.push(newRow);
      return Promise.resolve({ data: newRow, error: null });
    }

    let matched = rows.filter((r) => this.matches(r));
    if (this.orderCol) {
      matched = [...matched].sort((a, b) => {
        const av = a[this.orderCol!] as number | boolean;
        const bv = b[this.orderCol!] as number | boolean;
        const an = typeof av === "boolean" ? Number(av) : av;
        const bn = typeof bv === "boolean" ? Number(bv) : bv;
        return this.orderDesc ? (bn as number) - (an as number) : (an as number) - (bn as number);
      });
    }
    if (this.embedClauses) {
      matched = matched.map((row) => ({
        ...row,
        tenant_contract_clauses: (this.db.tables.tenant_contract_clauses ?? []).find(
          (c) => c.id === row.clause_id,
        ),
      }));
    }

    if (wantSingle) {
      const single = matched[0] ?? null;
      return Promise.resolve({ data: single, error: null });
    }
    return Promise.resolve({ data: matched, error: null });
  }

  then(resolve: (v: unknown) => void) {
    resolve(this.execute(false));
  }
}

class FakeDb {
  tables: Record<string, Row[]> = {};

  from(table: string) {
    return new FakeQuery(this, table);
  }
}

function makeDb(): SupabaseClient {
  return new FakeDb() as unknown as SupabaseClient;
}

function seed(db: SupabaseClient) {
  const fake = db as unknown as FakeDb;
  fake.tables.blueprint_contract_mappings = [
    { blueprint_id: "rental-cars", contract_template_key: "vehicle_rental", is_default: true },
  ];
  fake.tables.tenant_contract_templates = [
    {
      id: "tpl-vehicle-global",
      tenant_id: null,
      key: "vehicle_rental",
      party_type: "customer",
      status: "active",
    },
  ];
  fake.tables.tenant_contract_versions = [
    { id: "ver-1", template_id: "tpl-vehicle-global", version: 1, status: "published" },
  ];
  fake.tables.tenant_contract_clauses = [
    { id: "clause-general", category: "general", key: "GENERAL", content: "General terms." },
  ];
  fake.tables.tenant_contract_template_clauses = [
    {
      template_id: "tpl-vehicle-global",
      clause_id: "clause-general",
      is_mandatory: true,
      condition: null,
      sort_order: 0,
    },
  ];
  fake.tables.tenant_contract_requirements = [];
}

describe("TenantContractRequirementResolver.resolve", () => {
  let db: SupabaseClient;

  beforeEach(() => {
    db = makeDb();
    seed(db);
  });

  it("resolves the global template when no tenant override exists", async () => {
    const result = await TenantContractRequirementResolver.resolve(db, {
      tenantId: "tenant-1",
      partyType: "customer",
      blueprintId: "rental-cars",
      operatorRequired: false,
      operatorIncluded: false,
      trackingEnabled: false,
    });

    expect(result.templateId).toBe("tpl-vehicle-global");
    expect(result.versionId).toBe("ver-1");
    expect(result.requiredClauseKeys).toEqual(["GENERAL"]);
    expect(result.consumerRelationship).toBe("undetermined");
  });

  it("prefers a tenant-specific override template over the global one", async () => {
    const fake = db as unknown as FakeDb;
    fake.tables.tenant_contract_templates.push({
      id: "tpl-vehicle-tenant1",
      tenant_id: "tenant-1",
      key: "vehicle_rental",
      party_type: "customer",
      status: "active",
    });
    fake.tables.tenant_contract_versions.push({
      id: "ver-tenant1",
      template_id: "tpl-vehicle-tenant1",
      version: 1,
      status: "published",
    });

    const result = await TenantContractRequirementResolver.resolve(db, {
      tenantId: "tenant-1",
      partyType: "customer",
      blueprintId: "rental-cars",
      operatorRequired: false,
      operatorIncluded: false,
      trackingEnabled: false,
    });

    expect(result.templateId).toBe("tpl-vehicle-tenant1");
  });

  it("throws NoContractMappingError instead of falling back to a universal contract", async () => {
    await expect(
      TenantContractRequirementResolver.resolve(db, {
        tenantId: "tenant-1",
        partyType: "customer",
        blueprintId: "unmapped-blueprint",
        operatorRequired: false,
        operatorIncluded: false,
        trackingEnabled: false,
      }),
    ).rejects.toThrow(NoContractMappingError);
  });

  it("records the resolution context for audit", async () => {
    await TenantContractRequirementResolver.resolve(db, {
      tenantId: "tenant-1",
      partyType: "customer",
      blueprintId: "rental-cars",
      operatorRequired: false,
      operatorIncluded: false,
      trackingEnabled: true,
      consumerRelationship: "consumer",
    });

    const fake = db as unknown as FakeDb;
    const requirement = fake.tables.tenant_contract_requirements[0];
    expect(requirement.tenant_id).toBe("tenant-1");
    expect(requirement.tracking_enabled).toBe(true);
    expect(requirement.consumer_relationship).toBe("consumer");
  });
});
