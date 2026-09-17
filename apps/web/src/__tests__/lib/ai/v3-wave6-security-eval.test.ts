import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveGoal } from "../../../lib/ai/agent-goal";
import { getRecentEntities } from "../../../lib/ai/entity-context";
import { getGoalMetrics, getRoutingMetrics } from "../../../lib/ai/observability";
import { createRentalTool } from "../../../lib/ai/actions/tools/create-rental";
import { createMaintenanceRequestTool } from "../../../lib/ai/actions/tools/create-maintenance-request";
import { createInspectionTool } from "../../../lib/ai/actions/tools/create-inspection";
import type { AgentContext } from "../../../lib/ai/agent-context";
import type { TenantScope } from "../../../lib/tenant-context";

// Agent Runtime v3, Wave 6 ("Security + Eval") — spec sections 42-44,
// 56-57: AgentGoal/RecentEntity grant no permission by themselves, every
// write revalidates, and cross-tenant leakage must be provably zero
// (section 44: "Testar IDOR", literally). Same fake-in-memory-Supabase
// pattern already established by wave7-tools-isolation.test.ts — real
// code, fake data, no live DB or LLM call.

interface Row {
  [key: string]: unknown;
}
type Predicate = (row: Row) => boolean;

class FakeQuery implements PromiseLike<{ data: Row[]; error: null }> {
  private filters: Predicate[] = [];
  private limitN: number | null = null;
  constructor(private rows: Row[]) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (r[col] ?? null) === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col]) >= String(val));
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  async maybeSingle() {
    const found = this.rows.filter((r) => this.filters.every((f) => f(r)));
    return { data: found[0] ?? null, error: null };
  }
  then<TResult1, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    let found = this.rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.limitN != null) found = found.slice(0, this.limitN);
    return Promise.resolve(
      onfulfilled ? onfulfilled({ data: found, error: null }) : (undefined as never),
    );
  }
}

function makeDb(tables: Record<string, Row[]>): SupabaseClient {
  return {
    from: (table: string) => new FakeQuery(tables[table] ?? []),
  } as unknown as SupabaseClient;
}

function makeCtx(tenantId: string): AgentContext {
  return {
    tenantId,
    userId: "user-" + tenantId,
    tenantRole: "operator",
    permissions: [
      "tenant.rentals.create",
      "tenant.maintenance.create",
      "tenant.inspections.create",
    ],
    entitlements: { active: true, features: [], planKey: null },
    persona: "operator",
    authenticationLevel: "AAL1",
    currentModule: null,
    currentResource: null,
    aiBudget: { balance: 100, currency: "credits" },
    workspaceId: tenantId,
    availableOperationIds: [],
    currentOperationId: null,
  };
}

function makeScope(tenantId: string, db: SupabaseClient): TenantScope {
  return {
    tenantId,
    userId: "user-" + tenantId,
    tenantRole: "operator",
    isImpersonating: false,
    accessMode: "full",
    db,
  };
}

describe("Wave 6 — cross-tenant IDOR: agent_goals (spec section 44)", () => {
  it("a goal belonging to Tenant A is never returned when queried as Tenant B, even with the SAME conversationId", async () => {
    const db = makeDb({
      agent_goals: [
        {
          id: "goal-1",
          tenant_id: "tenant-A",
          conversation_id: "conv-shared",
          type: "CREATE_RENTAL",
          domain: "RENTAL",
          status: "ACTIVE",
          state: { customerOrganizationId: "org-secret" },
        },
      ],
    });
    const asTenantB = await getActiveGoal(db, "tenant-B", "conv-shared");
    expect(asTenantB).toBeNull();

    const asTenantA = await getActiveGoal(db, "tenant-A", "conv-shared");
    expect(asTenantA?.id).toBe("goal-1");
  });
});

describe("Wave 6 — cross-tenant IDOR: conversation entities (spec section 44)", () => {
  it("a recent entity recorded under Tenant A is never returned when queried as Tenant B", async () => {
    const db = makeDb({
      agent_conversation_entities: [
        {
          conversation_id: "conv-shared",
          tenant_id: "tenant-A",
          entity_type: "ORGANIZATION",
          entity_id: "org-secret",
          display_name: "Confidential Customer A",
          relation: "CURRENT_CUSTOMER",
          source: "CREATED_IN_CONVERSATION",
          referenced_at: new Date().toISOString(),
        },
      ],
    });
    const asTenantB = await getRecentEntities(db, "tenant-B", "conv-shared");
    expect(asTenantB).toEqual([]);

    const asTenantA = await getRecentEntities(db, "tenant-A", "conv-shared");
    expect(asTenantA).toHaveLength(1);
    expect(asTenantA[0].displayName).toBe("Confidential Customer A");
  });
});

describe("Wave 6 — IDOR: mutation tools revalidate every id against the caller's OWN tenant (spec section 42-44)", () => {
  it("create_rental rejects a customerOrganizationId that belongs to another tenant", async () => {
    const db = makeDb({
      organizations: [{ id: "org-A", tenant_id: "tenant-A", name: "Org A" }],
      assets: [{ id: "asset-B", tenant_id: "tenant-B" }],
    });
    const result = await createRentalTool.validate(
      {
        assetId: "asset-B",
        customerOrganizationId: "org-A",
        scheduledStartsAt: "2026-09-20T09:00:00Z",
        scheduledEndsAt: "2026-09-21T09:00:00Z",
      },
      makeCtx("tenant-B"),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/not found/);
  });

  it("create_rental rejects an assetId that belongs to another tenant, even with a valid same-tenant customer", async () => {
    const db = makeDb({
      organizations: [{ id: "org-B", tenant_id: "tenant-B", name: "Org B" }],
      assets: [{ id: "asset-A", tenant_id: "tenant-A" }],
    });
    const result = await createRentalTool.validate(
      {
        assetId: "asset-A",
        customerOrganizationId: "org-B",
        scheduledStartsAt: "2026-09-20T09:00:00Z",
        scheduledEndsAt: "2026-09-21T09:00:00Z",
      },
      makeCtx("tenant-B"),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/not found/);
  });

  it("create_maintenance_request rejects an assetId that belongs to another tenant", async () => {
    const db = makeDb({ assets: [{ id: "asset-A", tenant_id: "tenant-A" }] });
    const result = await createMaintenanceRequestTool.validate(
      { assetId: "asset-A", maintenanceType: "corrective", description: "barulho" },
      makeCtx("tenant-B"),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/not found/);
  });

  it("create_inspection rejects an assetId that belongs to another tenant", async () => {
    const db = makeDb({ assets: [{ id: "asset-A", tenant_id: "tenant-A" }] });
    const result = await createInspectionTool.validate(
      { assetId: "asset-A", inspectionType: "check_out", purpose: "check_out" },
      makeCtx("tenant-B"),
      makeScope("tenant-B", db),
    );
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/not found/);
  });
});

describe("Wave 6 — observability: getGoalMetrics aggregates real events correctly (spec section 46, 57: never falsify metrics)", () => {
  function activityRow(action: string, entityId: string, metadata: Record<string, unknown> = {}) {
    return {
      action,
      entity_id: entityId,
      metadata,
      tenant_id: "tenant-B",
      created_at: new Date().toISOString(),
    };
  }

  it("computes goalCompletionRate, entity resolution rates, and workflowResumeSuccessRate from real event rows", async () => {
    const db = makeDb({
      tenant_activity_log: [
        // Goal 1: started, resumed, progressed after resume, completed.
        activityRow("AGENT_WORKFLOW_STARTED", "goal-1"),
        activityRow("AGENT_WORKFLOW_RESUMED", "goal-1"),
        activityRow("AGENT_WORKFLOW_STEP_COMPLETED", "goal-1"),
        activityRow("AGENT_GOAL_COMPLETED", "goal-1"),
        // Goal 2: started, never completed (abandoned).
        activityRow("AGENT_WORKFLOW_STARTED", "goal-2"),
        // Entity resolution: 3 resolved, 1 ambiguous.
        activityRow("AGENT_ENTITY_RESOLVED", "n/a"),
        activityRow("AGENT_ENTITY_RESOLVED", "n/a"),
        activityRow("AGENT_ENTITY_RESOLVED", "n/a"),
        activityRow("AGENT_ENTITY_AMBIGUOUS", "n/a"),
      ],
    });
    const metrics = await getGoalMetrics(db, "tenant-B", 24);
    expect(metrics.goalsStarted).toBe(2);
    expect(metrics.goalsCompleted).toBe(1);
    expect(metrics.goalCompletionRate).toBe(0.5);
    expect(metrics.entityResolutionSuccessRate).toBe(0.75);
    expect(metrics.entityAmbiguityRate).toBe(0.25);
    // goal-1 was resumed AND later progressed -> resume succeeded.
    expect(metrics.workflowResumeSuccessRate).toBe(1);
  });

  it("detects a duplicate question — the SAME missingKey asked twice with no progress in between (regression per section 46)", async () => {
    const db = makeDb({
      tenant_activity_log: [
        activityRow("AGENT_WORKFLOW_STARTED", "goal-3"),
        activityRow("AGENT_NEXT_ACTION_SELECTED", "goal-3", {
          action: "ASK_USER",
          missingKey: "assetId",
        }),
        // No WORKFLOW_STEP_COMPLETED in between -- same field asked again.
        activityRow("AGENT_NEXT_ACTION_SELECTED", "goal-3", {
          action: "ASK_USER",
          missingKey: "assetId",
        }),
      ],
    });
    const metrics = await getGoalMetrics(db, "tenant-B", 24);
    expect(metrics.duplicateQuestionRate).toBe(0.5);
  });

  it("a different missingKey asked next is never counted as a duplicate", async () => {
    const db = makeDb({
      tenant_activity_log: [
        activityRow("AGENT_WORKFLOW_STARTED", "goal-4"),
        activityRow("AGENT_NEXT_ACTION_SELECTED", "goal-4", {
          action: "ASK_USER",
          missingKey: "customerOrganizationId",
        }),
        activityRow("AGENT_WORKFLOW_STEP_COMPLETED", "goal-4"),
        activityRow("AGENT_NEXT_ACTION_SELECTED", "goal-4", {
          action: "ASK_USER",
          missingKey: "assetId",
        }),
      ],
    });
    const metrics = await getGoalMetrics(db, "tenant-B", 24);
    expect(metrics.duplicateQuestionRate).toBe(0);
  });

  it("returns zeroed metrics (not an error) for a tenant with no activity in the window", async () => {
    const db = makeDb({ tenant_activity_log: [] });
    const metrics = await getGoalMetrics(db, "tenant-empty", 24);
    expect(metrics.goalsStarted).toBe(0);
    expect(metrics.goalCompletionRate).toBe(0);
    expect(metrics.duplicateQuestionRate).toBe(0);
  });
});

describe("Wave 6 — getRoutingMetrics still works unchanged (regression guard for the shared metrics API route)", () => {
  it("returns zeroed metrics for a tenant with no routing activity", async () => {
    const db = makeDb({ tenant_activity_log: [] });
    const metrics = await getRoutingMetrics(db, "tenant-empty", 24);
    expect(metrics.totalRequests).toBe(0);
  });
});
