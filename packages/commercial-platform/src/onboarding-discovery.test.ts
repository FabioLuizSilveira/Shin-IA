import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBlueprintWithRules, type ResolverProfileInput } from "./blueprint-resolver.js";
import { resolvePlanWithRules } from "./plan-resolver.js";
import { nextDiscoveryQuestion, isDiscoveryComplete, type DiscoveryQuestion } from "./discovery.js";

// The v1 rule sets, mirrored from
// supabase/migrations/20260914000000_onboarding_discovery.sql — the pure
// resolvers take rules as an argument precisely so the GATE test does not
// need a live DB.
const BLUEPRINT_RULES = {
  defaultBlueprintId: "generic-assets",
  verticals: {
    "rental-cars": {
      baseBlueprintId: "rental-cars",
      requiredCapabilities: ["tracking", "commercial"],
      optionalCapabilities: ["maintenance", "inspection"],
    },
    "rental-motorcycles": {
      baseBlueprintId: "rental-motorcycles",
      requiredCapabilities: ["commercial"],
      optionalCapabilities: ["tracking", "maintenance", "inspection"],
    },
    guincho: {
      baseBlueprintId: "mobility",
      requiredCapabilities: ["tracking", "towing", "commercial"],
      optionalCapabilities: ["maintenance", "workflow"],
    },
  },
  answerCapabilities: {
    needs_tracking: { whenTrue: ["tracking"] },
    needs_integration: { whenTrue: ["integration"] },
    operator_dispatch: { whenTrue: ["workflow"] },
  },
};

const PLAN_RULES = {
  planRank: ["starter", "professional"],
  defaultPlanKey: "starter",
  assetThresholds: [
    { maxAssets: 25, planKey: "starter" },
    { maxAssets: null, planKey: "professional" },
  ],
  capabilityMinPlan: { tracking: "professional", integration: "professional" },
  verticalFloor: {
    munk: "professional",
    crane: "professional",
    "tower-crane": "professional",
    agriculture: "professional",
    guincho: "professional",
  },
  extensionsByCapability: {
    tracking: ["tracking"],
    integration: ["integrations"],
    towing: ["tracking"],
  },
  optionalAddOnsByVertical: {
    "rental-cars": ["ai_credits_pack"],
    guincho: ["tracking_pro"],
    agriculture: ["telemetry_connector"],
  },
};

function resolve(profile: ResolverProfileInput) {
  const bp = resolveBlueprintWithRules(profile, 1, BLUEPRINT_RULES);
  const plan = resolvePlanWithRules(profile, bp, 1, PLAN_RULES);
  return { bp, plan };
}

describe("WAVE 2 GATE — deterministic blueprint + plan resolution", () => {
  it("AUTOLOC (rental-cars) → rental-cars blueprint, professional plan", () => {
    const { bp, plan } = resolve({ primaryVertical: "rental-cars", answers: [] });
    expect(bp.baseBlueprintId).toBe("rental-cars");
    expect(bp.requiredCapabilities).toContain("tracking");
    // tracking is a required capability => professional floor
    expect(plan.recommendedPlanKey).toBe("professional");
    expect(plan.recommendedExtensions).toContain("tracking");
  });

  it("MOTOLOC (rental-motorcycles) with a small fleet → rental-motorcycles, starter", () => {
    const { bp, plan } = resolve({
      primaryVertical: "rental-motorcycles",
      answers: [{ questionKey: "asset_quantity", value: 12 }],
    });
    expect(bp.baseBlueprintId).toBe("rental-motorcycles");
    expect(bp.requiredCapabilities).toEqual(["commercial"]);
    expect(plan.recommendedPlanKey).toBe("starter");
  });

  it("GUINCHOLOC (guincho) → mobility base + towing capability, professional floor", () => {
    const { bp, plan } = resolve({ primaryVertical: "guincho", answers: [] });
    expect(bp.baseBlueprintId).toBe("mobility");
    expect(bp.requiredCapabilities).toEqual(["commercial", "towing", "tracking"].sort());
    expect(plan.recommendedPlanKey).toBe("professional");
    expect(plan.optionalAddOns).toEqual(["tracking_pro"]);
  });

  it("is deterministic — same input twice yields identical output", () => {
    const input: ResolverProfileInput = {
      primaryVertical: "guincho",
      additionalVerticals: ["rental-cars"],
      answers: [
        { questionKey: "asset_quantity", value: 40 },
        { questionKey: "needs_integration", value: true },
      ],
    };
    expect(JSON.stringify(resolve(input))).toBe(JSON.stringify(resolve(input)));
  });

  it("MOTOLOC that answers 'needs tracking' is promoted to professional", () => {
    const { bp, plan } = resolve({
      primaryVertical: "rental-motorcycles",
      answers: [
        { questionKey: "asset_quantity", value: 8 },
        { questionKey: "needs_tracking", value: true },
      ],
    });
    expect(bp.requiredCapabilities).toContain("tracking");
    expect(plan.recommendedPlanKey).toBe("professional");
    expect(plan.reasons.some((r) => r.code === "PLAN_BY_CAPABILITY")).toBe(true);
  });

  it("unknown vertical falls back to generic-assets / starter, with a reason", () => {
    const { bp, plan } = resolve({ primaryVertical: "spaceships", answers: [] });
    expect(bp.baseBlueprintId).toBe("generic-assets");
    expect(bp.reasons.some((r) => r.code === "VERTICAL_FALLBACK")).toBe(true);
    expect(plan.recommendedPlanKey).toBe("starter");
  });

  it("a large fleet alone pushes any vertical to professional", () => {
    const { plan } = resolve({
      primaryVertical: "rental-motorcycles",
      answers: [{ questionKey: "asset_quantity", value: 200 }],
    });
    expect(plan.recommendedPlanKey).toBe("professional");
    expect(plan.reasons.some((r) => r.code === "PLAN_BY_ASSET_COUNT")).toBe(true);
  });
});

// ── discovery: adaptive next-question ──────────────────────────────────────
const QUESTIONS: DiscoveryQuestion[] = [
  {
    key: "primary_activity",
    prompt: "?",
    helpText: null,
    questionType: "single_select",
    options: [],
    appliesToVerticals: [],
    mapsTo: "primaryVertical",
    required: true,
    sortOrder: 10,
  },
  {
    key: "asset_quantity",
    prompt: "?",
    helpText: null,
    questionType: "number",
    options: [],
    appliesToVerticals: [],
    mapsTo: "assetQuantity",
    required: true,
    sortOrder: 30,
  },
  {
    key: "operator_dispatch",
    prompt: "?",
    helpText: null,
    questionType: "boolean",
    options: [],
    appliesToVerticals: ["munk", "crane"],
    mapsTo: "operationalCapabilities",
    required: false,
    sortOrder: 90,
  },
];

describe("WAVE 2 — adaptive discovery", () => {
  it("asks primary_activity first, then vertical-independent questions", () => {
    expect(nextDiscoveryQuestion(QUESTIONS, [])?.key).toBe("primary_activity");
    const next = nextDiscoveryQuestion(QUESTIONS, [
      { questionKey: "primary_activity", value: "rental-cars" },
    ]);
    expect(next?.key).toBe("asset_quantity");
  });

  it("skips operator_dispatch for rental-cars but asks it for munk", () => {
    const carAnswers = [
      { questionKey: "primary_activity", value: "rental-cars" },
      { questionKey: "asset_quantity", value: 10 },
    ];
    expect(nextDiscoveryQuestion(QUESTIONS, carAnswers)).toBeNull();
    expect(isDiscoveryComplete(QUESTIONS, carAnswers)).toBe(true);

    const munkAnswers = [
      { questionKey: "primary_activity", value: "munk" },
      { questionKey: "asset_quantity", value: 10 },
    ];
    expect(nextDiscoveryQuestion(QUESTIONS, munkAnswers)?.key).toBe("operator_dispatch");
    // operator_dispatch is optional → discovery is still "complete"
    expect(isDiscoveryComplete(QUESTIONS, munkAnswers)).toBe(true);
  });

  it("is not complete until required questions are answered", () => {
    expect(isDiscoveryComplete(QUESTIONS, [])).toBe(false);
  });
});

// ── DB-loading paths (FakeDb) ──────────────────────────────────────────────
class FakeQuery {
  private eqs: Array<{ c: string; v: unknown }> = [];
  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}
  select() {
    return this;
  }
  eq(c: string, v: unknown) {
    this.eqs.push({ c, v });
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    const rows = (this.db.tables[this.table] ?? []).filter((r) =>
      this.eqs.every((f) => r[f.c] === f.v),
    );
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }
  then(resolve: (v: unknown) => void) {
    const rows = (this.db.tables[this.table] ?? []).filter((r) =>
      this.eqs.every((f) => r[f.c] === f.v),
    );
    resolve({ data: rows, error: null });
  }
}
class FakeDb {
  tables: Record<string, Record<string, unknown>[]> = {};
  from(t: string) {
    return new FakeQuery(this, t);
  }
}

describe("WAVE 2 — resolver rules load from the active version only", () => {
  it("loadActiveBlueprintResolverRules picks active = true", async () => {
    const { loadActiveBlueprintResolverRules } = await import("./blueprint-resolver.js");
    const db = new FakeDb();
    db.tables.blueprint_resolver_rules = [
      { rule_version: 1, active: false, rules: { defaultBlueprintId: "old" } },
      { rule_version: 2, active: true, rules: { defaultBlueprintId: "generic-assets" } },
    ];
    const loaded = await loadActiveBlueprintResolverRules(db as unknown as SupabaseClient);
    expect(loaded.ruleVersion).toBe(2);
  });
});
