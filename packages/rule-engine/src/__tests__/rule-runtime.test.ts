import { describe, it, expect, vi, beforeEach } from "vitest";
import { RuleRuntime } from "../rule-runtime.js";
import { RuleRegistry } from "../rule-registry.js";
import type { Rule, RuleRepository, RuleContext } from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = "2026-01-01T00:00:00Z";

const makeRule = (overrides: Partial<Rule> = {}): Rule => ({
  id: "rule-1",
  name: "Expired Contract Blocker",
  description: "Blocks operations when contract is expired",
  tenantId: "tenant-1",
  enabled: true,
  priority: 10,
  condition: { type: "simple", field: "status", operator: "eq", value: "expired" },
  actions: [{ type: "block", reason: "Contract expired" }],
  triggers: ["operation.create"],
  metadata: {},
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const context: RuleContext = {
  tenantId: "tenant-1",
  entityType: "contract",
  entityId: "contract-1",
  eventType: "operation.create",
  data: { status: "expired" },
  metadata: {},
};

// ─── Mock Repo ────────────────────────────────────────────────────────────────

function makeMockRepo(rules: Rule[] = [makeRule()]): RuleRepository {
  return {
    findById: vi
      .fn()
      .mockImplementation((id: string) => Promise.resolve(rules.find((r) => r.id === id) ?? null)),
    findByTrigger: vi.fn().mockResolvedValue(rules),
    findByTenant: vi.fn().mockResolvedValue(rules),
    findPlatformRules: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((r: Rule) => Promise.resolve(r)),
    update: vi.fn().mockImplementation((r: Rule) => Promise.resolve(r)),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── RuleRuntime Tests ────────────────────────────────────────────────────────

describe("RuleRuntime", () => {
  let repo: RuleRepository;
  let runtime: RuleRuntime;

  beforeEach(() => {
    repo = makeMockRepo();
    runtime = new RuleRuntime({ ruleRepository: repo });
  });

  it("evaluates rules and returns matched result", async () => {
    const result = await runtime.evaluate(context);
    expect(result.totalRulesEvaluated).toBe(1);
    expect(result.matchedRules).toBe(1);
    expect(result.blockedBy).not.toBeNull();
    expect(result.blockedBy?.reason).toBe("Contract expired");
  });

  it("returns no match when condition is false", async () => {
    const rule = makeRule({
      condition: { type: "simple", field: "status", operator: "eq", value: "active" },
      actions: [{ type: "block", reason: "Should not block" }],
    });
    repo = makeMockRepo([rule]);
    runtime = new RuleRuntime({ ruleRepository: repo });

    const result = await runtime.evaluate({ ...context, data: { status: "expired" } });
    expect(result.matchedRules).toBe(0);
    expect(result.blockedBy).toBeNull();
  });

  it("skips disabled rules", async () => {
    const rule = makeRule({ enabled: false });
    repo = makeMockRepo([rule]);
    runtime = new RuleRuntime({ ruleRepository: repo });

    const result = await runtime.evaluate(context);
    expect(result.totalRulesEvaluated).toBe(0);
  });

  it("stops evaluating after a block action", async () => {
    const blockRule = makeRule({ id: "rule-block", priority: 1 });
    const notifyRule = makeRule({
      id: "rule-notify",
      priority: 2,
      actions: [{ type: "notify", target: "manager", template: "alert" }],
    });
    repo = makeMockRepo([blockRule, notifyRule]);
    runtime = new RuleRuntime({ ruleRepository: repo });

    const result = await runtime.evaluate(context);
    // Only block rule was evaluated before stopping
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.ruleId).toBe("rule-block");
  });

  it("executes registered action executors", async () => {
    const notify = makeRule({
      actions: [{ type: "notify", target: "manager", template: "alert" }],
    });
    repo = makeMockRepo([notify]);
    runtime = new RuleRuntime({ ruleRepository: repo });

    const executor = { execute: vi.fn().mockResolvedValue(undefined) };
    runtime.registerActionExecutor("notify", executor);

    await runtime.evaluate(context);
    expect(executor.execute).toHaveBeenCalled();
  });

  it("captures action execution errors without throwing", async () => {
    const notify = makeRule({
      actions: [{ type: "notify", target: "manager", template: "alert" }],
    });
    repo = makeMockRepo([notify]);
    runtime = new RuleRuntime({ ruleRepository: repo });

    const executor = { execute: vi.fn().mockRejectedValue(new Error("SMTP down")) };
    runtime.registerActionExecutor("notify", executor);

    const result = await runtime.evaluate(context);
    expect(result.results[0]?.errors).toHaveLength(1);
    expect(result.results[0]?.errors[0]).toContain("SMTP down");
  });

  it("handles unknown condition type gracefully (returns false, no throw)", async () => {
    const brokenRule = makeRule({
      condition: { type: "garbage" } as unknown as import("../types.js").Condition,
    });
    repo = makeMockRepo([brokenRule]);
    runtime = new RuleRuntime({ ruleRepository: repo });

    const result = await runtime.evaluate(context);
    expect(result.results[0]?.matched).toBe(false);
    expect(result.results[0]?.errors).toHaveLength(0); // unknown type silently returns false
  });

  it("isBlocked returns true when blockedBy is set", async () => {
    const result = await runtime.evaluate(context);
    expect(runtime.isBlocked(result)).toBe(true);
  });

  it("isBlocked returns false when no block", async () => {
    const rule = makeRule({
      condition: { type: "simple", field: "status", operator: "eq", value: "active" },
    });
    repo = makeMockRepo([rule]);
    runtime = new RuleRuntime({ ruleRepository: repo });

    const result = await runtime.evaluate({ ...context, data: { status: "expired" } });
    expect(runtime.isBlocked(result)).toBe(false);
  });

  it("evaluateRule directly on unmatched rule", async () => {
    const rule = makeRule({
      condition: { type: "simple", field: "x", operator: "eq", value: "y" },
    });
    const result = await runtime.evaluateRule(rule, { ...context, data: { x: "z" } });
    expect(result.matched).toBe(false);
  });

  it("includes log actions in executed list", async () => {
    const logRule = makeRule({
      actions: [{ type: "log", level: "warn", message: "Test warning" }],
    });
    repo = makeMockRepo([logRule]);
    runtime = new RuleRuntime({ ruleRepository: repo });

    const result = await runtime.evaluate(context);
    expect(result.results[0]?.actionsExecuted).toHaveLength(1);
    expect(result.results[0]?.actionsExecuted[0]?.type).toBe("log");
  });

  it("evaluates platform rules alongside tenant rules", async () => {
    const platformRule = makeRule({ id: "platform-1", tenantId: null, priority: 1 });
    repo = {
      ...makeMockRepo([]),
      findByTrigger: vi.fn().mockResolvedValue([makeRule()]),
      findPlatformRules: vi.fn().mockResolvedValue([platformRule]),
    };
    runtime = new RuleRuntime({ ruleRepository: repo });
    const result = await runtime.evaluate(context);
    // platform rule blocks first (priority 1 < priority 10)
    expect(result.results[0]?.ruleId).toBe("platform-1");
  });
});

// ─── RuleRegistry Tests ───────────────────────────────────────────────────────

describe("RuleRegistry", () => {
  let repo: RuleRepository;
  let registry: RuleRegistry;

  beforeEach(() => {
    const existingRule = makeRule();
    repo = makeMockRepo([existingRule]);
    registry = new RuleRegistry({ ruleRepository: repo });
  });

  it("registers a new rule with generated id and timestamps", async () => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...ruleInput } = makeRule();
    const rule = await registry.registerRule(ruleInput);
    expect(rule.id).toBeDefined();
    expect(rule.createdAt).toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it("updates an existing rule", async () => {
    const updated = await registry.updateRule("rule-1", { name: "Updated Name" });
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ name: "Updated Name" }));
    expect(updated).toBeDefined();
  });

  it("throws when updating nonexistent rule", async () => {
    repo.findById = vi.fn().mockResolvedValue(null);
    await expect(registry.updateRule("missing", { name: "x" })).rejects.toThrow("not found");
  });

  it("enables a rule", async () => {
    await registry.enableRule("rule-1");
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it("disables a rule", async () => {
    await registry.disableRule("rule-1");
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("deletes a rule", async () => {
    await registry.deleteRule("rule-1");
    expect(repo.delete).toHaveBeenCalledWith("rule-1");
  });

  it("throws when deleting nonexistent rule", async () => {
    repo.findById = vi.fn().mockResolvedValue(null);
    await expect(registry.deleteRule("missing")).rejects.toThrow("not found");
  });

  it("gets a rule by id", async () => {
    const rule = await registry.getRule("rule-1");
    expect(rule?.id).toBe("rule-1");
  });

  it("gets all rules for a tenant", async () => {
    await registry.getRulesForTenant("tenant-1");
    expect(repo.findByTenant).toHaveBeenCalledWith("tenant-1");
  });

  it("gets rules for an event (merges tenant + platform)", async () => {
    await registry.getRulesForEvent("tenant-1", "operation.create");
    expect(repo.findByTrigger).toHaveBeenCalledWith("tenant-1", "operation.create");
    expect(repo.findPlatformRules).toHaveBeenCalledWith("operation.create");
  });
});
