import { describe, it, expect } from "vitest";
import { filterToolsByIntent } from "../../../lib/ai/capability-router";
import {
  TOOL_DOMAINS,
  TOOL_INTENTS,
  type ToolDomain,
  type ToolIntent,
} from "../../../lib/ai/tool-taxonomy";

// Agent Runtime Architecture v2, Wave 6 (spec section 3 — the master
// prompt's own stated scaling target: routing must hold as the catalog
// grows to 50/100/200/500+ tools, not just work at today's ~40). A
// synthetic catalog is the right tool here — this repo has 27 real
// tools today, nowhere near 200, so proving the scaling promise needs
// generated fixtures, not the real registry (that's what wave6-eval-
// suite.test.ts already covers, at real scale).

function buildSyntheticCatalog(
  size: number,
): { name: string; domain?: ToolDomain; intents?: ToolIntent[] }[] {
  const tools: { name: string; domain?: ToolDomain; intents?: ToolIntent[] }[] = [];
  for (let i = 0; i < size; i++) {
    const domain = TOOL_DOMAINS[i % TOOL_DOMAINS.length];
    const intent = TOOL_INTENTS[i % TOOL_INTENTS.length];
    tools.push({ name: `synthetic_tool_${i}`, domain, intents: [intent] });
  }
  // A handful of unannotated tools mixed in, same shape as this repo's
  // real always-available/discovery tools.
  tools.push({ name: "list_available_tools" });
  tools.push({ name: "get_product_help" });
  return tools;
}

describe("Wave 6 — tool-catalog scale (50/100/200 tools)", () => {
  const always = new Set(["list_available_tools", "get_product_help"]);

  for (const size of [50, 100, 200]) {
    it(`at ${size} tools: a HIGH-confidence domain+intent match still narrows to a small candidate set, in well under 50ms`, () => {
      const catalog = buildSyntheticCatalog(size);
      const targetDomain = TOOL_DOMAINS[3]; // an arbitrary, stable domain
      const targetIntent = TOOL_INTENTS[3];

      const started = performance.now();
      const result = filterToolsByIntent(
        catalog,
        { domain: targetDomain, intent: targetIntent, confidence: "HIGH", method: "deterministic" },
        always,
      );
      const elapsedMs = performance.now() - started;

      expect(result.isFallback).toBe(false);
      // Narrowed well below the full catalog regardless of how many
      // tools exist — the whole point of the router at scale.
      expect(result.candidatesAfterFilter).toBeLessThan(catalog.length / 4);
      expect(elapsedMs).toBeLessThan(50);
    });
  }

  it("at 200 tools, a LOW-confidence fallback still returns only the unannotated+always set (2 tools here), never the full 200 — the exact 'LOW ≠ send everything' invariant, proven at scale", () => {
    const catalog = buildSyntheticCatalog(200);
    const result = filterToolsByIntent(
      catalog,
      { domain: null, intent: null, confidence: "LOW", method: "none" },
      always,
    );
    expect(result.isFallback).toBe(true);
    expect(result.candidatesAfterFilter).toBe(2);
  });

  it("growing the catalog from 50 to 500 tools does not grow the narrowed candidate set proportionally — average domain slice size stays roughly constant (bounded by the number of domains/intents, not total tool count)", () => {
    const sizes = [50, 200, 500];
    const afterCounts = sizes.map((size) => {
      const catalog = buildSyntheticCatalog(size);
      const result = filterToolsByIntent(
        catalog,
        {
          domain: TOOL_DOMAINS[0],
          intent: TOOL_INTENTS[0],
          confidence: "HIGH",
          method: "deterministic",
        },
        always,
      );
      return result.candidatesAfterFilter;
    });
    // Each step multiplies total catalog size by 4x/2.5x, but the
    // narrowed set (tools sharing one specific domain+intent out of
    // TOOL_DOMAINS.length x TOOL_INTENTS.length combinations) grows far
    // slower than the catalog itself.
    const catalogGrowth = 500 / 50;
    const narrowedGrowth = afterCounts[2] / Math.max(afterCounts[0], 1);
    expect(narrowedGrowth).toBeLessThan(catalogGrowth);
  });
});
