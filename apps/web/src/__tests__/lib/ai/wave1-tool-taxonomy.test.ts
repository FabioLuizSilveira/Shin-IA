import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAgentToolRegistry } from "../../../lib/ai/tools";
import { allMutationToolNames } from "../../../lib/ai/actions/tools";
import { createOrganizationTool } from "../../../lib/ai/actions/tools/create-organization";
import { searchCustomersTool, getCustomerTool } from "../../../lib/ai/tools/customers";
import type { AgentContext } from "../../../lib/ai/agent-context";
import type { TenantScope } from "../../../lib/tenant-context";

// Same shape as tool-registry.test.ts's own FakeFlagsQuery — every
// requiredFeature check resolves to "no row" (disabled), which is fine:
// these tests only care about permission-less tools like
// list_available_tools, never reached through a feature-flag gate.
class FakeFlagsQuery {
  select() {
    return this;
  }
  eq() {
    return this;
  }
  async maybeSingle() {
    return { data: null, error: null };
  }
}

function makeScope(): TenantScope {
  const db = {
    from: (table: string) => {
      if (table === "tenant_feature_flags") return new FakeFlagsQuery();
      throw new Error(`unexpected table in test: ${table}`);
    },
  } as unknown as SupabaseClient;
  return {
    tenantId: "t",
    userId: "u",
    tenantRole: null,
    isImpersonating: false,
    accessMode: "full",
    db,
  };
}

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    tenantId: "t",
    userId: "u",
    tenantRole: null,
    permissions: [],
    entitlements: { active: true, features: [], planKey: null },
    persona: null,
    authenticationLevel: "AAL1",
    currentModule: null,
    currentResource: null,
    aiBudget: { balance: 0, currency: "credits" },
    workspaceId: "t",
    availableOperationIds: [],
    currentOperationId: null,
    ...overrides,
  };
}

// Agent Runtime Architecture v2, Wave 1 — baseline + regression coverage
// for two real things found during the audit (spec sections 2-4), not a
// simulation of the LLM's own unreliable tool selection (that's not
// something a unit test can assert on deterministically; it was
// live-verified by hand against the real backend instead — see this
// wave's report). These tests protect the two structural facts a router
// in a later wave will depend on.
describe("Wave 1 — Tool Registry v2 baseline", () => {
  it("list_available_tools (read registry) always includes itself and other permission-less tools regardless of ctx", async () => {
    const registry = buildAgentToolRegistry();
    const available = await registry.listAvailable(makeScope(), makeCtx());
    const names = available.map((t) => t.name);
    expect(names).toContain("list_available_tools");
  });

  it("mutation tool names (create_asset, create_organization, mark_notifications_read, create_transport_request, create_towing_request, create_rental, create_maintenance_request, create_inspection) are exported for list_available_tools to merge in — the actual root cause of the original bug: it used to report read tools only, so a model asking itself 'what can I do?' concluded actions like create_organization didn't exist even though they were in the real tools schema", () => {
    expect(allMutationToolNames).toEqual(
      expect.arrayContaining([
        "create_asset",
        "create_organization",
        "mark_notifications_read",
        "create_transport_request",
        "create_towing_request",
        "create_rental",
        "create_maintenance_request",
        "create_inspection",
      ]),
    );
    // Agent Runtime v3, Wave 4 added create_maintenance_request and
    // create_inspection — this count is expected to keep growing as more
    // goal types get real mutation tools; update it deliberately, not by
    // deleting the check.
    expect(allMutationToolNames).toHaveLength(8);
  });

  it("create_organization and the customer read tools carry ORGANIZATION domain metadata (Tool Registry v2, spec section 4)", () => {
    expect(createOrganizationTool.domain).toBe("ORGANIZATION");
    expect(createOrganizationTool.intents).toEqual(["CREATE"]);
    expect(searchCustomersTool.domain).toBe("ORGANIZATION");
    expect(searchCustomersTool.intents).toEqual(["SEARCH"]);
    expect(getCustomerTool.domain).toBe("ORGANIZATION");
    expect(getCustomerTool.intents).toEqual(["GET"]);
  });

  it("a tool with no requiredPermission/requiredFeature (like list_available_tools) is visible even to a context with zero permissions — today's ONLY filter is IAM (permission+flag), never domain/intent; this is the exact gap a Dynamic Tool Filter closes in a later wave", async () => {
    const registry = buildAgentToolRegistry();
    const available = await registry.listAvailable(makeScope(), makeCtx({ permissions: [] }));
    expect(available.some((t) => t.name === "list_available_tools")).toBe(true);
  });
});
