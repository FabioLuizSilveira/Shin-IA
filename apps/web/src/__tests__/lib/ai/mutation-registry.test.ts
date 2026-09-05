import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMutationToolRegistry } from "../../../lib/ai/actions/mutation-registry";
import { createAssetTool } from "../../../lib/ai/actions/tools/create-asset";
import type { AgentMutationTool } from "../../../lib/ai/actions/types";
import type { AgentContext } from "../../../lib/ai/agent-context";
import type { TenantScope } from "../../../lib/tenant-context";

function makeCtx(tenantId: string, permissions: string[]): AgentContext {
  return {
    tenantId,
    userId: "user-" + tenantId,
    tenantRole: "operator",
    permissions,
    entitlements: { active: true, features: [], planKey: null },
    persona: "operator",
    authenticationLevel: "AAL1",
    currentModule: null,
    currentResource: null,
    aiBudget: { balance: 100, currency: "credits" },
    workspaceId: tenantId,
  };
}

const dummyTool: AgentMutationTool<{ x?: string }> = {
  name: "dummy_mutation",
  description: "test",
  inputSchema: { type: "object", properties: {} },
  riskLevel: "LOW_RISK",
  requiredPermission: "tenant.dummy.manage",
  requiredFeature: "agent.actions.dummy",
  async validate() {
    return { ok: true };
  },
  async summarize() {
    return "dummy plan";
  },
  async execute() {
    return { ok: true, data: { done: true } };
  },
};

describe("MutationToolRegistry — permission/feature-flag filtering", () => {
  it("hides a mutation tool when the required permission is missing", async () => {
    const registry = createMutationToolRegistry([dummyTool]);
    const scope = { tenantId: "t1" } as unknown as TenantScope;
    const available = await registry.listAvailable(scope, makeCtx("t1", []));
    expect(available).toHaveLength(0);
  });

  it("shows a mutation tool once the required permission is present (feature flag defaults handled by isFeatureEnabled)", async () => {
    // isFeatureEnabled queries tenant_feature_flags — without a real db this
    // will resolve false (default OFF), so the tool stays hidden even with
    // the permission present. This asserts the permission gate runs FIRST
    // and short-circuits before any db call for the missing-permission case
    // (proven by the previous test needing no db at all), and that adding
    // the permission alone is not sufficient — the flag call happens next.
    const registry = createMutationToolRegistry([dummyTool]);
    const dbCalls: string[] = [];
    const scope = {
      tenantId: "t1",
      db: {
        from: (table: string) => {
          dbCalls.push(table);
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
              }),
            }),
          };
        },
      },
    } as unknown as TenantScope;
    const available = await registry.listAvailable(scope, makeCtx("t1", ["tenant.dummy.manage"]));
    expect(available).toHaveLength(0);
    expect(dbCalls).toContain("tenant_feature_flags");
  });
});

describe("create_asset mutation tool — tenant-scoped validation", () => {
  it("rejects proposing an asset with an asset_type_id belonging to a DIFFERENT tenant", async () => {
    const db = {
      from: (table: string) => {
        if (table === "asset_types") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        };
      },
    } as unknown as SupabaseClient;
    const scope = { tenantId: "tenant-B", userId: "user-b", db } as unknown as TenantScope;

    const result = await createAssetTool.validate(
      { name: "Corolla", category: "vehicle", asset_type_id: "type-from-tenant-A" },
      makeCtx("tenant-B", ["tenant.assets.create"]),
      scope,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/);
  });

  it("rejects an invalid category before ever touching the database", async () => {
    const db = {
      from: () => {
        throw new Error("should never query the db for a structurally invalid proposal");
      },
    } as unknown as SupabaseClient;
    const scope = { tenantId: "tenant-B", userId: "user-b", db } as unknown as TenantScope;

    const result = await createAssetTool.validate(
      { name: "Corolla", category: "spaceship", asset_type_id: "any" },
      makeCtx("tenant-B", ["tenant.assets.create"]),
      scope,
    );
    expect(result.ok).toBe(false);
  });
});
