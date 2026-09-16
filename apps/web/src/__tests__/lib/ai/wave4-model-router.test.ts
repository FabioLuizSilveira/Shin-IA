import { describe, it, expect } from "vitest";
import { resolveModelForTier, resolveAgentModelTier } from "../../../lib/ai/model-router";

// Agent Runtime Architecture v2, Wave 4 ("Model Router") — resolveModelForTier
// is now a real per-tier map (no longer a stub returning undefined for
// everything), and resolveAgentModelTier is the routing decision grounded
// in the Capability Router's actual before/after filter counts, not a
// guess from classification confidence alone.
describe("Wave 4 — resolveModelForTier", () => {
  it("FAST and STANDARD resolve to the proven default (gpt-4o-mini)", () => {
    expect(resolveModelForTier("FAST")).toBe("gpt-4o-mini");
    expect(resolveModelForTier("STANDARD")).toBe("gpt-4o-mini");
  });

  it("COMPLEX resolves to a real, more capable model (gpt-4o)", () => {
    expect(resolveModelForTier("COMPLEX")).toBe("gpt-4o");
  });
});

describe("Wave 4 — resolveAgentModelTier", () => {
  it("a forced single-tool match (HIGH confidence, exact domain+intent) -> FAST", () => {
    const tier = resolveAgentModelTier({ forced: true, isFallback: false });
    expect(tier).toBe("FAST");
  });

  it("a real domain match, not forced -> STANDARD", () => {
    const tier = resolveAgentModelTier({ forced: false, isFallback: false });
    expect(tier).toBe("STANDARD");
  });

  it("a fallback (LOW confidence, or a domain with zero annotated tools) -> COMPLEX — the decision rests on isFallback, never on candidate counts (a fallback still shrinks the raw count by excluding OTHER domains' annotated tools, which a real live test caught as a false 'real narrowing' signal in an earlier version of this function)", () => {
    const tier = resolveAgentModelTier({ forced: false, isFallback: true });
    expect(tier).toBe("COMPLEX");
  });
});
