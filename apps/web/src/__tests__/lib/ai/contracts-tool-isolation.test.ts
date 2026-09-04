import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getContractSignatureStatusTool } from "../../../lib/ai/tools/contracts";
import type { AgentContext } from "../../../lib/ai/agent-context";
import type { TenantScope } from "../../../lib/tenant-context";

interface Row {
  [key: string]: unknown;
}

class FakeQuery {
  private eqFilters: Record<string, unknown> = {};
  constructor(
    private readonly tables: Record<string, Row[]>,
    private readonly table: string,
  ) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.eqFilters[col] = val;
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  async maybeSingle() {
    const rows = this.tables[this.table] ?? [];
    const row = rows.find((r) => Object.entries(this.eqFilters).every(([k, v]) => r[k] === v));
    return { data: row ?? null, error: null };
  }
}

function makeDb(tables: Record<string, Row[]>): SupabaseClient {
  return { from: (table: string) => new FakeQuery(tables, table) } as unknown as SupabaseClient;
}

function makeCtx(): AgentContext {
  return {
    tenantId: "tenant-B",
    userId: "user-b",
    tenantRole: "operator",
    permissions: ["tenant.contracts.view"],
    entitlements: { active: true, features: [], planKey: null },
    persona: "operator",
    authenticationLevel: "AAL1",
    currentModule: null,
    currentResource: null,
    aiBudget: { balance: 100, currency: "credits" },
    workspaceId: "tenant-B",
  };
}

describe("getContractSignatureStatusTool — cross-tenant isolation", () => {
  it("returns not-found for a contractId that belongs to a DIFFERENT tenant, never that tenant's data", async () => {
    const db = makeDb({
      contracts: [{ id: "contract-A", tenant_id: "tenant-A" }],
    });
    const scope: TenantScope = {
      tenantId: "tenant-B",
      userId: "user-b",
      tenantRole: "operator",
      isImpersonating: false,
      accessMode: "full",
      db,
    };
    const result = await getContractSignatureStatusTool.execute(
      { contractId: "contract-A" },
      makeCtx(),
      scope,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("succeeds for a contract that really belongs to this tenant", async () => {
    const db = makeDb({
      contracts: [{ id: "contract-B", tenant_id: "tenant-B" }],
      signature_requests: [],
    });
    const scope: TenantScope = {
      tenantId: "tenant-B",
      userId: "user-b",
      tenantRole: "operator",
      isImpersonating: false,
      accessMode: "full",
      db,
    };
    const result = await getContractSignatureStatusTool.execute(
      { contractId: "contract-B" },
      makeCtx(),
      scope,
    );
    expect(result.ok).toBe(true);
    expect(result.data).toBeNull(); // no signature_requests row seeded — null status, not an error
  });
});
