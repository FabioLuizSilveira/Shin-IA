import { describe, it, expect } from "vitest";
import {
  validateDraftRequest,
  canTransition,
  DEFAULT_BUDGET_POLICY,
} from "../safety/draft-policy.js";
import { selectProvider } from "../ai/operation-router.js";
import { MKT_PLAN_LIMITS, planAllows, withinLimit } from "../plans.js";
import { MKT_MCP_TOOLS } from "../mcp/tools.js";
import type { MktDraft } from "../types.js";

function draft(status: MktDraft["status"]): MktDraft {
  return {
    id: "d1",
    workspaceId: "w1",
    tenantId: "t1",
    entityType: "campaign",
    action: "create",
    payload: {},
    status,
    requestedBy: "u1",
  };
}

describe("validateDraftRequest", () => {
  it("accepts a draft within budget policy", () => {
    const result = validateDraftRequest({
      entityType: "campaign",
      action: "create",
      payload: { budget_daily: 100 },
      requestedBy: "u1",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects daily budget above policy limit", () => {
    const result = validateDraftRequest({
      entityType: "campaign",
      action: "create",
      payload: { budget_daily: DEFAULT_BUDGET_POLICY.maxDailyBudget + 1 },
      requestedBy: "u1",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects total budget above policy limit", () => {
    const result = validateDraftRequest({
      entityType: "campaign",
      action: "create",
      payload: { budget_total: DEFAULT_BUDGET_POLICY.maxTotalBudget + 1 },
      requestedBy: "u1",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects publishing an ad without a creative preview", () => {
    const result = validateDraftRequest({
      entityType: "ad",
      action: "publish",
      payload: {},
      requestedBy: "u1",
    });
    expect(result.ok).toBe(false);
  });

  it("allows publishing an ad with a creative preview", () => {
    const result = validateDraftRequest({
      entityType: "ad",
      action: "publish",
      payload: { creative_url: "https://cdn.example.com/ad.png" },
      requestedBy: "u1",
    });
    expect(result.ok).toBe(true);
  });
});

describe("canTransition", () => {
  it("pending can be approved or rejected", () => {
    expect(canTransition(draft("pending"), "approved")).toBe(true);
    expect(canTransition(draft("pending"), "rejected")).toBe(true);
    expect(canTransition(draft("pending"), "applied")).toBe(false);
  });

  it("approved can only be applied", () => {
    expect(canTransition(draft("approved"), "applied")).toBe(true);
    expect(canTransition(draft("approved"), "rejected")).toBe(false);
  });

  it("applied can be rolled back", () => {
    expect(canTransition(draft("applied"), "rolled_back")).toBe(true);
  });

  it("rejected and rolled_back are terminal", () => {
    expect(canTransition(draft("rejected"), "approved")).toBe(false);
    expect(canTransition(draft("rolled_back"), "pending" as MktDraft["status"])).toBe(false);
  });
});

describe("selectProvider", () => {
  const anthropic = { provider: "anthropic", isDefault: false, isActive: true } as const;
  const openai = { provider: "openai", isDefault: false, isActive: true } as const;

  it("returns undefined when nothing is configured", () => {
    expect(selectProvider("copy", [])).toBeUndefined();
  });

  it("prefers the workspace default over operation preferences", () => {
    const result = selectProvider("copy", [{ ...anthropic }, { ...openai, isDefault: true }]);
    expect(result?.provider).toBe("openai");
  });

  it("falls back to operation preference order", () => {
    expect(selectProvider("copy", [{ ...openai }, { ...anthropic }])?.provider).toBe("anthropic");
    expect(selectProvider("generate_ad", [{ ...openai }, { ...anthropic }])?.provider).toBe(
      "openai",
    );
  });

  it("skips inactive providers", () => {
    const result = selectProvider("copy", [{ ...anthropic, isActive: false }, { ...openai }]);
    expect(result?.provider).toBe("openai");
  });
});

describe("plan limits", () => {
  it("free plan blocks cloning and integrations", () => {
    expect(planAllows("free", "adClonesPerMonth")).toBe(false);
    expect(planAllows("free", "adIntegrations")).toBe(false);
    expect(planAllows("free", "mcpServer")).toBe(false);
  });

  it("pro plan enables mcp server and unlimited generations", () => {
    expect(planAllows("pro", "mcpServer")).toBe(true);
    expect(withinLimit("pro", "aiGenerationsPerMonth", 999_999)).toBe(true);
  });

  it("starter enforces generation ceiling", () => {
    expect(withinLimit("starter", "aiGenerationsPerMonth", 99)).toBe(true);
    expect(withinLimit("starter", "aiGenerationsPerMonth", 100)).toBe(false);
  });

  it("every plan has a limits entry", () => {
    expect(Object.keys(MKT_PLAN_LIMITS)).toEqual([
      "free",
      "starter",
      "pro",
      "business",
      "enterprise",
    ]);
  });
});

describe("mcp tools", () => {
  it("every mutating tool is draft-only by name", () => {
    for (const tool of MKT_MCP_TOOLS.filter((t) => t.mutating)) {
      expect(tool.name).toMatch(/draft/);
      expect(tool.description.toLowerCase()).toContain("approval");
    }
  });

  it("no tool publishes directly", () => {
    const names = MKT_MCP_TOOLS.map((t) => t.name);
    expect(names).not.toContain("publish_campaign");
    expect(names).not.toContain("publish_ad");
  });
});
