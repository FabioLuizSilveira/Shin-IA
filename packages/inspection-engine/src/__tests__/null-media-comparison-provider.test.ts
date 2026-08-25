import { describe, it, expect } from "vitest";
import { NullMediaComparisonProvider } from "../media-comparison-provider.js";

describe("NullMediaComparisonProvider", () => {
  it("returns null instead of throwing when no real AI provider is configured", async () => {
    const provider = new NullMediaComparisonProvider();
    const result = await provider.compare({
      beforeImageUrl: "https://example.com/before.jpg",
      afterImageUrl: "https://example.com/after.jpg",
      itemKey: "rear_bumper",
      itemLabel: "Para-choque traseiro",
    });
    expect(result).toBeNull();
    expect(provider.name).toBe("none");
  });
});
