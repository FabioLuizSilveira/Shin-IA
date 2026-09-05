import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchTenantKnowledgeTool } from "../../../lib/ai/tools/knowledge";
import type { AgentContext } from "../../../lib/ai/agent-context";
import type { TenantScope } from "../../../lib/tenant-context";

function makeCtx(tenantId: string): AgentContext {
  return {
    tenantId,
    userId: "user-" + tenantId,
    tenantRole: "operator",
    permissions: ["tenant.knowledge.view"],
    entitlements: { active: true, features: [], planKey: null },
    persona: "operator",
    authenticationLevel: "AAL1",
    currentModule: null,
    currentResource: null,
    aiBudget: { balance: 100, currency: "credits" },
    workspaceId: tenantId,
  };
}

describe("search_tenant_knowledge — tenant scoping", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Stub OpenAI's embeddings endpoint (the real network call inside
    // runEmbeddingGateway) so this test never hits the network — the
    // meaningful assertion here is which p_tenant_id the tool passes to
    // the isolation-enforcing Postgres function, not the embedding itself.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              model: "text-embedding-3-small",
              data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
              usage: { prompt_tokens: 3 },
            }),
            { status: 200 },
          ),
      ),
    );
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("passes this tenant's own tenantId to match_tenant_knowledge_chunks, never a client-suppliable value", async () => {
    const rpcCalls: { name: string; params: unknown }[] = [];
    // Generic chainable no-op: select/eq/order/limit/insert all return
    // `this`; maybeSingle() resolves null (cost-policy lookup finds no
    // row, so the credit pre-check/post-debit steps are skipped — those
    // are exercised by ai-gateway's own gateway.test.ts, not here) and
    // single() resolves a fake usage-row id for the insert's .select().
    class FakeChain {
      select() {
        return this;
      }
      eq() {
        return this;
      }
      order() {
        return this;
      }
      limit() {
        return this;
      }
      insert() {
        return this;
      }
      async maybeSingle() {
        return { data: null, error: null };
      }
      async single() {
        return { data: { id: "usage-1" }, error: null };
      }
    }
    const db = {
      from: () => new FakeChain(),
      rpc: async (name: string, params: unknown) => {
        rpcCalls.push({ name, params });
        return { data: [], error: null };
      },
    } as unknown as SupabaseClient;

    const scope: TenantScope = {
      tenantId: "tenant-B",
      userId: "user-tenant-B",
      tenantRole: "operator",
      isImpersonating: false,
      accessMode: "full",
      db,
    };

    const result = await searchTenantKnowledgeTool.execute(
      { query: "qual a política de devolução?" },
      makeCtx("tenant-B"),
      scope,
    );

    expect(result.ok).toBe(true);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("match_tenant_knowledge_chunks");
    expect((rpcCalls[0].params as { p_tenant_id: string }).p_tenant_id).toBe("tenant-B");
  });

  it("rejects an empty query without calling the embedding gateway or the database at all", async () => {
    const db = {
      from: () => {
        throw new Error("should never query the db for an empty query");
      },
      rpc: () => {
        throw new Error("should never call rpc for an empty query");
      },
    } as unknown as SupabaseClient;
    const scope: TenantScope = {
      tenantId: "tenant-B",
      userId: "user-tenant-B",
      tenantRole: "operator",
      isImpersonating: false,
      accessMode: "full",
      db,
    };

    const result = await searchTenantKnowledgeTool.execute(
      { query: "  " },
      makeCtx("tenant-B"),
      scope,
    );
    expect(result.ok).toBe(false);
  });
});
