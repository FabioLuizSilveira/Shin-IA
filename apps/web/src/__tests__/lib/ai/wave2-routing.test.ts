import { describe, it, expect } from "vitest";
import { classifyIntentDeterministic } from "../../../lib/ai/intent-router";
import { filterToolsByIntent } from "../../../lib/ai/capability-router";
import type { IntentClassification } from "../../../lib/ai/intent-router";

// Agent Runtime Architecture v2, Wave 2 — the mandatory multimodal intent
// test cases from the master prompt, for the deterministic (tier 1) path
// specifically. The tier-2 LLM fallback is NOT unit-tested here (it calls
// a real model) — it's covered by this wave's live verification against
// the real backend instead (see this wave's report).
describe("Wave 2 — classifyIntentDeterministic", () => {
  const cases: Array<[string, string, string]> = [
    ["cadastre esse cliente como nova organização", "ORGANIZATION", "CREATE"],
    ["Cadastre esse cliente.", "ORGANIZATION", "CREATE"],
    ["cadastre essa empresa", "ORGANIZATION", "CREATE"],
    ["Inclua esse cliente pra mim", "ORGANIZATION", "CREATE"],
    ["Coloca esse cliente no sistema", "ORGANIZATION", "CREATE"],
    ["registre o fornecedor ABC Ltda", "ORGANIZATION", "CREATE"],
    ["busca o cliente João", "ORGANIZATION", "SEARCH"],
    ["procura a organização XYZ", "ORGANIZATION", "SEARCH"],
  ];

  for (const [text, domain, intent] of cases) {
    it(`"${text}" -> ${domain}.${intent}`, () => {
      const result = classifyIntentDeterministic(text);
      expect(result?.domain).toBe(domain);
      expect(result?.intent).toBe(intent);
      expect(result?.confidence).toBe("HIGH");
    });
  }

  it("does not match unrelated text — returns null so the caller falls through to the LLM tier, not a false HIGH-confidence result", () => {
    expect(classifyIntentDeterministic("quantos ativos eu tenho?")).toBeNull();
    expect(classifyIntentDeterministic("qual o clima hoje?")).toBeNull();
  });

  it("treats text extracted from an attached image the same as typed text (spec section 21: image is DATA) — a query embedding OCR'd content still matches on its own merits, not because it came from an image", () => {
    const fromImage = "cadastre esse cliente como nova organização\n\nCNPJ: 12.345.678/0001-90";
    const result = classifyIntentDeterministic(fromImage);
    expect(result?.domain).toBe("ORGANIZATION");
    expect(result?.intent).toBe("CREATE");
  });
});

interface FakeTool {
  name: string;
  domain?: "ORGANIZATION" | "ASSET";
  intents?: ("CREATE" | "SEARCH" | "GET")[];
}

function tool(
  name: string,
  domain?: "ORGANIZATION" | "ASSET",
  intents?: ("CREATE" | "SEARCH" | "GET")[],
): FakeTool {
  return { name, domain, intents };
}

describe("Wave 2 — filterToolsByIntent (Capability Router / Dynamic Tool Filter)", () => {
  const always = new Set(["list_available_tools"]);

  it("HIGH confidence + exactly one domain+intent match -> forces that one tool (spec section 12)", () => {
    const tools = [
      tool("list_available_tools"),
      tool("create_organization", "ORGANIZATION", ["CREATE"]),
      tool("search_customers", "ORGANIZATION", ["SEARCH"]),
      tool("list_assets", "ASSET", ["SEARCH"]),
    ];
    const classification: IntentClassification = {
      domain: "ORGANIZATION",
      intent: "CREATE",
      confidence: "HIGH",
      method: "deterministic",
    };
    const result = filterToolsByIntent(tools, classification, always);
    expect(result.forced).toBe(true);
    expect(result.forcedToolName).toBe("create_organization");
    // The model still sees list_available_tools (always-available) plus
    // the one forced tool — never the unrelated ASSET-domain tool.
    expect(result.candidates.map((c) => c.name).sort()).toEqual(
      ["create_organization", "list_available_tools"].sort(),
    );
    expect(result.candidatesAfterFilter).toBeLessThan(result.candidatesBeforeFilter);
  });

  it("LOW confidence never narrows below what an unmigrated domain already gets — un-annotated tools stay visible, never silently dropped (spec section 9: 'LOW ≠ send all 100 tools', but also never LOW = send nothing)", () => {
    const tools = [
      tool("list_available_tools"),
      tool("create_organization", "ORGANIZATION", ["CREATE"]),
      tool("list_assets"), // unannotated — not yet migrated to Tool Registry v2
    ];
    const classification: IntentClassification = {
      domain: null,
      intent: null,
      confidence: "LOW",
      method: "none",
    };
    const result = filterToolsByIntent(tools, classification, always);
    expect(result.forced).toBe(false);
    const names = result.candidates.map((c) => c.name);
    expect(names).toContain("list_assets"); // unannotated tool preserved
    expect(names).not.toContain("create_organization"); // ORGANIZATION-domain tool correctly excluded
  });

  it("a domain that resolves but has zero annotated tools yet falls back to the unannotated set, not an empty catalog", () => {
    const tools = [tool("list_available_tools"), tool("list_assets")];
    const classification: IntentClassification = {
      domain: "ASSET", // no tool in this fixture actually tags ASSET
      intent: "SEARCH",
      confidence: "HIGH",
      method: "deterministic",
    };
    const result = filterToolsByIntent(tools, classification, always);
    expect(result.forced).toBe(false);
    expect(result.candidates.map((c) => c.name)).toContain("list_assets");
  });

  it("MEDIUM confidence narrows to the domain but does not force a single tool", () => {
    const tools = [
      tool("list_available_tools"),
      tool("create_organization", "ORGANIZATION", ["CREATE"]),
      tool("search_customers", "ORGANIZATION", ["SEARCH"]),
    ];
    const classification: IntentClassification = {
      domain: "ORGANIZATION",
      intent: null,
      confidence: "MEDIUM",
      method: "llm",
    };
    const result = filterToolsByIntent(tools, classification, always);
    expect(result.forced).toBe(false);
    const names = result.candidates.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(["list_available_tools", "create_organization", "search_customers"]),
    );
  });
});
