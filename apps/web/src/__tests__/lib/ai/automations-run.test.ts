import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// createNotification() internally calls createAdminClient(), which needs
// real Supabase env vars this unit test has no business depending on —
// mocked at the module boundary instead, same as any other unit test
// isolating pure logic from a live side effect.
const createNotificationMock = vi.fn();
vi.mock("@/lib/notifications/create-notification", () => ({
  createNotification: (...args: unknown[]) => createNotificationMock(...args),
}));

const { runDueAutomations } = await import("../../../lib/ai/automations/run");

interface Row {
  [key: string]: unknown;
}
type Predicate = (row: Row) => boolean;

class FakeChain implements PromiseLike<{ data: Row[]; error: null }> {
  private filters: Predicate[] = [];
  constructor(
    private tableRows: Row[],
    private onUpdate?: (patch: Record<string, unknown>, filters: Predicate[]) => void,
  ) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push((r) => (r[col] ?? null) === val);
    return this;
  }
  gte(col: string, val: string) {
    this.filters.push((r) => (r[col] as string) >= val);
    return this;
  }
  lte(col: string, val: string) {
    this.filters.push((r) => (r[col] as string) <= val);
    return this;
  }
  update(patch: Record<string, unknown>) {
    this.onUpdate?.(patch, this.filters);
    return this;
  }
  then<TResult1, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
  ): PromiseLike<TResult1 | TResult2> {
    const found = this.tableRows.filter((r) => this.filters.every((f) => f(r)));
    return Promise.resolve(
      onfulfilled ? onfulfilled({ data: found, error: null }) : (undefined as never),
    );
  }
}

describe("runDueAutomations — tenant flag double-gate + contract dedup", () => {
  it("never runs an automation for a tenant without the agent.automation.enabled flag, even if the automation row itself is enabled=true", async () => {
    const tables: Record<string, Row[]> = {
      tenant_feature_flags: [], // no tenant has the platform-level flag on
      agent_automations: [
        {
          id: "auto-1",
          tenant_id: "tenant-A",
          automation_type: "daily_summary",
          conditions: {},
          last_run_state: {},
          enabled: true,
          frequency: "daily",
        },
      ],
    };
    const admin = {
      from: (table: string) => new FakeChain(tables[table] ?? []),
    } as unknown as SupabaseClient;

    const results = await runDueAutomations(admin);
    expect(results).toHaveLength(0);
  });

  it("only notifies about a contract once across repeated runs (dedup via last_run_state)", async () => {
    let updatedState: Record<string, unknown> | null = null;
    const tables: Record<string, Row[]> = {
      tenant_feature_flags: [
        { tenant_id: "tenant-A", flag_key: "agent.automation.enabled", enabled: true },
      ],
      agent_automations: [
        {
          id: "auto-2",
          tenant_id: "tenant-A",
          automation_type: "contract_expiry_alert",
          conditions: { withinDays: 30 },
          last_run_state: { notifiedContractIds: ["contract-old"] },
          enabled: true,
          frequency: "daily",
        },
      ],
      contracts: [
        {
          id: "contract-old",
          tenant_id: "tenant-A",
          status: "active",
          deleted_at: null,
          period_ends_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
          organizations: { name: "Cliente Antigo" },
        },
        {
          id: "contract-new",
          tenant_id: "tenant-A",
          status: "active",
          deleted_at: null,
          period_ends_at: new Date(Date.now() + 10 * 86_400_000).toISOString(),
          organizations: { name: "Cliente Novo" },
        },
      ],
    };
    const admin = {
      from: (table: string) => {
        if (table === "agent_automations") {
          return new FakeChain(tables.agent_automations, (patch) => {
            updatedState = patch.last_run_state as Record<string, unknown>;
          });
        }
        return new FakeChain(tables[table] ?? []);
      },
    } as unknown as SupabaseClient;

    const results = await runDueAutomations(admin);
    expect(results).toEqual([{ automationId: "auto-2", status: "ok", error: undefined }]);
    expect(
      (updatedState as unknown as { notifiedContractIds: string[] } | null)?.notifiedContractIds,
    ).toEqual(expect.arrayContaining(["contract-old", "contract-new"]));
  });
});
