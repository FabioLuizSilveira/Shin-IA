import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeepLinkTool } from "../../../lib/ai/tools/deep-link";
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
  async maybeSingle() {
    const rows = this.tables[this.table] ?? [];
    const row = rows.find((r) => Object.entries(this.eqFilters).every(([k, v]) => r[k] === v));
    return { data: row ?? null, error: null };
  }
}

function makeScope(tables: Record<string, Row[]>): TenantScope {
  const db = {
    from: (table: string) => new FakeQuery(tables, table),
  } as unknown as SupabaseClient;
  return {
    tenantId: "tenant-B",
    userId: "user-b",
    tenantRole: "operator",
    isImpersonating: false,
    accessMode: "full",
    db,
  };
}

function makeCtx(permissions: string[]): AgentContext {
  return {
    tenantId: "tenant-B",
    userId: "user-b",
    tenantRole: "operator",
    permissions,
    entitlements: { active: true, features: [], planKey: null },
    persona: "operator",
    authenticationLevel: "AAL1",
    currentModule: null,
    currentResource: null,
    aiBudget: { balance: 100, currency: "credits" },
    workspaceId: "tenant-B",
  };
}

describe("getDeepLinkTool", () => {
  it("denies a target type the tenant has no permission for", async () => {
    const scope = makeScope({});
    const result = await getDeepLinkTool.execute(
      { targetType: "asset", targetId: "asset-1" },
      makeCtx([]),
      scope,
    );
    expect(result.ok).toBe(false);
  });

  it("returns not-found for an asset id belonging to a DIFFERENT tenant", async () => {
    const scope = makeScope({ assets: [{ id: "asset-A", tenant_id: "tenant-A" }] });
    const result = await getDeepLinkTool.execute(
      { targetType: "asset", targetId: "asset-A" },
      makeCtx(["tenant.assets.view"]),
      scope,
    );
    expect(result.ok).toBe(false);
  });

  it("builds a real link for an asset that belongs to this tenant", async () => {
    const scope = makeScope({ assets: [{ id: "asset-B", tenant_id: "tenant-B" }] });
    const result = await getDeepLinkTool.execute(
      { targetType: "asset", targetId: "asset-B" },
      makeCtx(["tenant.assets.view"]),
      scope,
    );
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ url: "shinacustomer://assets/asset-B" });
  });

  it("notification_center needs no id and no tenant lookup", async () => {
    const scope = makeScope({});
    const result = await getDeepLinkTool.execute(
      { targetType: "notification_center" },
      makeCtx([]),
      scope,
    );
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ url: "shinacustomer://notifications" });
  });
});
