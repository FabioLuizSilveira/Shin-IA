import { describe, expect, it } from "vitest";
import { resolveBlueprintWithRules, type ResolverProfileInput } from "./blueprint-resolver.js";
import { resolvePlanWithRules } from "./plan-resolver.js";
import { questionApplies, collectSelectedVerticals, type DiscoveryQuestion } from "./discovery.js";
import {
  mapVerticalToOperationType,
  resolveOperationProfilesForProfile,
} from "./operation-type-mapping.js";

// WAVE 2 — Multi-Operation Business Architecture v2: the GATE for this wave
// is "Rental + Towing + Passenger Transport resolves correctly". Rules
// mirrored from supabase/migrations/20260924000000_multi_operation_
// discovery.sql (blueprint_resolver_rules v2 / plan_resolver_rules v2) so
// this stays a pure, no-DB test.

const BLUEPRINT_RULES_V2 = {
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
      requiredCapabilities: ["tracking", "towing", "dispatch", "service_request", "commercial"],
      optionalCapabilities: ["maintenance", "workflow"],
    },
    "passenger-transport": {
      baseBlueprintId: "mobility",
      requiredCapabilities: [
        "transport_request",
        "trip",
        "route",
        "schedule",
        "driver_allocation",
        "commercial",
      ],
      optionalCapabilities: ["tracking", "maintenance"],
    },
  },
  answerCapabilities: {
    needs_tracking: { whenTrue: ["tracking"] },
    needs_integration: { whenTrue: ["integration"] },
    operator_dispatch: { whenTrue: ["workflow"] },
  },
};

const PLAN_RULES_V2 = {
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
    "passenger-transport": "professional",
  },
  extensionsByCapability: {
    tracking: ["tracking"],
    integration: ["integrations"],
    towing: ["tracking"],
    route: ["tracking"],
  },
  optionalAddOnsByVertical: {
    "rental-cars": ["ai_credits_pack"],
    guincho: ["tracking_pro"],
    agriculture: ["telemetry_connector"],
    "passenger-transport": ["tracking_pro"],
  },
};

describe("WAVE 2 GATE — Rental + Towing + Passenger Transport resolves correctly", () => {
  const profile: ResolverProfileInput = {
    primaryVertical: "rental-cars",
    additionalVerticals: ["guincho", "passenger-transport"],
    answers: [],
  };

  it("blueprint resolution merges and dedupes capabilities from every operation", () => {
    const blueprint = resolveBlueprintWithRules(profile, 2, BLUEPRINT_RULES_V2);
    expect(blueprint.baseBlueprintId).toBe("rental-cars");
    expect(blueprint.requiredCapabilities).toEqual(
      [
        "tracking",
        "commercial",
        "towing",
        "dispatch",
        "service_request",
        "transport_request",
        "trip",
        "route",
        "schedule",
        "driver_allocation",
      ].sort(),
    );
    // rental-cars' own optional "inspection" survives; passenger-transport's
    // "tracking" optional is dropped since tracking is already required.
    expect(blueprint.optionalCapabilities).toContain("maintenance");
    expect(blueprint.optionalCapabilities).toContain("inspection");
    expect(blueprint.optionalCapabilities).toContain("workflow");
    expect(blueprint.optionalCapabilities).not.toContain("tracking");
    expect(blueprint.additionalBlueprintIds).toEqual(["mobility"]);
  });

  it("plan resolution floors at professional because of the additional verticals, even though rental-cars alone would not", () => {
    const blueprint = resolveBlueprintWithRules(profile, 2, BLUEPRINT_RULES_V2);
    const plan = resolvePlanWithRules(profile, blueprint, 2, PLAN_RULES_V2);
    expect(plan.recommendedPlanKey).toBe("professional");
    expect(
      plan.reasons.some((r) => r.code === "PLAN_FLOOR_VERTICAL" && r.inputs.vertical === "guincho"),
    ).toBe(true);
    expect(
      plan.reasons.some(
        (r) => r.code === "PLAN_FLOOR_VERTICAL" && r.inputs.vertical === "passenger-transport",
      ),
    ).toBe(true);
    expect(plan.optionalAddOns).toContain("ai_credits_pack");
    expect(plan.optionalAddOns).toContain("tracking_pro");
  });

  it("a rental-only tenant is NOT floored to professional by an unrelated vertical", () => {
    const rentalOnly: ResolverProfileInput = {
      primaryVertical: "rental-motorcycles",
      additionalVerticals: [],
      answers: [],
    };
    const blueprint = resolveBlueprintWithRules(rentalOnly, 2, BLUEPRINT_RULES_V2);
    const plan = resolvePlanWithRules(rentalOnly, blueprint, 2, PLAN_RULES_V2);
    expect(plan.recommendedPlanKey).toBe("starter");
  });

  it("resolveOperationProfilesForProfile maps to the three distinct Wave 1 operation types", () => {
    const resolved = resolveOperationProfilesForProfile(profile);
    expect(resolved).toEqual([
      { vertical: "rental-cars", type: "vehicle_rental", role: "primary" },
      { vertical: "guincho", type: "towing_service", role: "secondary" },
      { vertical: "passenger-transport", type: "passenger_transport", role: "secondary" },
    ]);
  });

  it("mapVerticalToOperationType covers every catalog vertical and falls back to 'other' for unknowns", () => {
    expect(mapVerticalToOperationType("rental-cars")).toBe("vehicle_rental");
    expect(mapVerticalToOperationType("guincho")).toBe("towing_service");
    expect(mapVerticalToOperationType("water-tank-truck")).toBe("water_tank_service");
    expect(mapVerticalToOperationType("sand-gravel-transport")).toBe("bulk_material_transport");
    expect(mapVerticalToOperationType("passenger-transport")).toBe("passenger_transport");
    expect(mapVerticalToOperationType("munk")).toBe("munk_operation");
    expect(mapVerticalToOperationType("something-not-in-the-catalog")).toBe("other");
  });

  // Same dispatch kernel as guincho (spec sections 8-9 reused kernel;
  // confirmed with the user this generalizes to water-tank-truck and
  // sand-gravel-transport the same way).
  it("resolves rental + water-tank-truck + sand-gravel-transport to 3 distinct operation types", () => {
    const resolved = resolveOperationProfilesForProfile({
      primaryVertical: "rental-cars",
      additionalVerticals: ["water-tank-truck", "sand-gravel-transport"],
    });
    expect(resolved).toEqual([
      { vertical: "rental-cars", type: "vehicle_rental", role: "primary" },
      { vertical: "water-tank-truck", type: "water_tank_service", role: "secondary" },
      { vertical: "sand-gravel-transport", type: "bulk_material_transport", role: "secondary" },
    ]);
  });

  it("collapses two verticals mapping to the same operation type into one profile", () => {
    const dup: ResolverProfileInput = {
      primaryVertical: "rental-cars",
      additionalVerticals: ["fleet-mobility"], // both map to vehicle_rental
      answers: [],
    };
    const resolved = resolveOperationProfilesForProfile(dup);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toEqual({
      vertical: "rental-cars",
      type: "vehicle_rental",
      role: "primary",
    });
  });
});

describe("multi-vertical discovery question applicability", () => {
  const towingQuestion: DiscoveryQuestion = {
    key: "towing_service_model",
    prompt: "Como os guinchos são utilizados?",
    helpText: null,
    questionType: "single_select",
    options: [],
    appliesToVerticals: ["guincho"],
    mapsTo: "towingServiceModel",
    required: false,
    sortOrder: 45,
  };
  const transportQuestion: DiscoveryQuestion = {
    key: "transport_service_model",
    prompt: "Como as viagens normalmente acontecem?",
    helpText: null,
    questionType: "single_select",
    options: [],
    appliesToVerticals: ["passenger-transport"],
    mapsTo: "transportServiceModel",
    required: false,
    sortOrder: 47,
  };
  const genericQuestion: DiscoveryQuestion = {
    key: "team_size",
    prompt: "Quantas pessoas vão usar o sistema?",
    helpText: null,
    questionType: "number",
    options: [],
    appliesToVerticals: [],
    mapsTo: "users",
    required: true,
    sortOrder: 50,
  };

  it("surfaces towing AND passenger-transport follow-ups when both are additional verticals, not just the primary's", () => {
    const answers = [
      { questionKey: "primary_activity", value: "rental-cars" },
      { questionKey: "other_activities", value: ["guincho", "passenger-transport"] },
    ];
    const verticals = collectSelectedVerticals(answers);
    expect(verticals.sort()).toEqual(["guincho", "passenger-transport", "rental-cars"].sort());
    expect(questionApplies(towingQuestion, verticals)).toBe(true);
    expect(questionApplies(transportQuestion, verticals)).toBe(true);
    expect(questionApplies(genericQuestion, verticals)).toBe(true);
  });

  it("does NOT surface an unrelated operation's follow-up when it wasn't selected", () => {
    const answers = [{ questionKey: "primary_activity", value: "rental-cars" }];
    const verticals = collectSelectedVerticals(answers);
    expect(questionApplies(towingQuestion, verticals)).toBe(false);
    expect(questionApplies(transportQuestion, verticals)).toBe(false);
  });

  it("collectSelectedVerticals dedupes and ignores non-string entries", () => {
    const answers = [
      { questionKey: "primary_activity", value: "guincho" },
      { questionKey: "other_activities", value: ["guincho", "passenger-transport", 42, null] },
    ];
    expect(collectSelectedVerticals(answers).sort()).toEqual(
      ["guincho", "passenger-transport"].sort(),
    );
  });
});
