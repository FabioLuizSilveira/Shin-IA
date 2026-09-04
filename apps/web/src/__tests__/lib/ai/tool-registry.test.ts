import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAgentToolRegistry } from "../../../lib/ai/tool-registry";
import type { AgentTool } from "../../../lib/ai/tool-types";
import type { AgentContext } from "../../../lib/ai/agent-context";
import type { TenantScope } from "../../../lib/tenant-context";

interface FlagRow {
  tenant_id: string;
  flag_key: string;
  enabled: boolean;
}

class FakeFlagsQuery {
  private eqFilters: Record<string, unknown> = {};
  constructor(private readonly rows: FlagRow[]) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.eqFilters[col] = val;
    return this;
  }
  async maybeSingle() {
    const row = this.rows.find(
      (r) => r.tenant_id === this.eqFilters.tenant_id && r.flag_key === this.eqFilters.flag_key,
    );
    return { data: row ? { enabled: row.enabled } : null, error: null };
  }
}

function makeScope(flags: FlagRow[]): TenantScope {
  const db = {
    from: (table: string) => {
      if (table === "tenant_feature_flags") return new FakeFlagsQuery(flags);
      throw new Error(`unexpected table in test: ${table}`);
    },
  } as unknown as SupabaseClient;
  return {
    tenantId: "tenant-1",
    userId: "user-1",
    tenantRole: "operator",
    isImpersonating: false,
    accessMode: "full",
    db,
  };
}

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    tenantId: "tenant-1",
    userId: "user-1",
    tenantRole: "operator",
    permissions: [],
    entitlements: { active: true, features: [], planKey: null },
    persona: "operator",
    authenticationLevel: "AAL1",
    currentModule: null,
    currentResource: null,
    aiBudget: { balance: 100, currency: "credits" },
    workspaceId: "tenant-1",
    ...overrides,
  };
}

function makeTool(overrides: Partial<AgentTool> = {}): AgentTool {
  return {
    name: "test_tool",
    description: "a test tool",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      return { ok: true, data: "result" };
    },
    ...overrides,
  };
}

describe("AgentToolRegistry", () => {
  it("rejects registering a tool whose inputSchema declares a tenantId field", () => {
    const bad = makeTool({
      name: "bad_tool",
      inputSchema: { type: "object", properties: { tenantId: { type: "string" } } },
    });
    expect(() => createAgentToolRegistry([bad])).toThrow(/tenantId/);
  });

  it("hides a tool from listAvailable when the required permission is missing", async () => {
    const registry = createAgentToolRegistry([
      makeTool({ requiredPermission: "tenant.assets.view" }),
    ]);
    const scope = makeScope([]);
    const ctx = makeCtx({ permissions: [] });
    const available = await registry.listAvailable(scope, ctx);
    expect(available).toHaveLength(0);
  });

  it("shows a tool once the required permission is present", async () => {
    const registry = createAgentToolRegistry([
      makeTool({ requiredPermission: "tenant.assets.view" }),
    ]);
    const scope = makeScope([]);
    const ctx = makeCtx({ permissions: ["tenant.assets.view"] });
    const available = await registry.listAvailable(scope, ctx);
    expect(available).toHaveLength(1);
  });

  it("hides a tool from listAvailable when the required feature flag is off", async () => {
    const registry = createAgentToolRegistry([makeTool({ requiredFeature: "agent.tools.assets" })]);
    const scope = makeScope([
      { tenant_id: "tenant-1", flag_key: "agent.tools.assets", enabled: false },
    ]);
    const ctx = makeCtx();
    const available = await registry.listAvailable(scope, ctx);
    expect(available).toHaveLength(0);
  });

  it("shows a tool once the required feature flag is enabled for this tenant", async () => {
    const registry = createAgentToolRegistry([makeTool({ requiredFeature: "agent.tools.assets" })]);
    const scope = makeScope([
      { tenant_id: "tenant-1", flag_key: "agent.tools.assets", enabled: true },
    ]);
    const ctx = makeCtx();
    const available = await registry.listAvailable(scope, ctx);
    expect(available).toHaveLength(1);
  });

  it("a feature flag enabled for a DIFFERENT tenant does not leak into this tenant's availability", async () => {
    const registry = createAgentToolRegistry([makeTool({ requiredFeature: "agent.tools.assets" })]);
    const scope = makeScope([
      { tenant_id: "tenant-OTHER", flag_key: "agent.tools.assets", enabled: true },
    ]);
    const ctx = makeCtx();
    const available = await registry.listAvailable(scope, ctx);
    expect(available).toHaveLength(0);
  });

  it("rejects executing a tool with tenantId in its args, even if otherwise available", async () => {
    const tool = makeTool();
    const registry = createAgentToolRegistry([tool]);
    const scope = makeScope([]);
    const ctx = makeCtx();
    const result = await registry.execute("test_tool", { tenantId: "tenant-OTHER" }, ctx, scope, [
      tool,
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tenantId/);
  });

  it("denies executing a tool name the model names but that isn't in the available list", async () => {
    const tool = makeTool();
    const registry = createAgentToolRegistry([tool]);
    const scope = makeScope([]);
    const ctx = makeCtx();
    // available list is empty — as if the tool was filtered out by
    // permission/flag — the model naming it anyway must not execute it.
    const result = await registry.execute("test_tool", {}, ctx, scope, []);
    expect(result.ok).toBe(false);
  });
});
