import { describe, it, expect } from "vitest";
import { ACTIVE_PIPELINE_ORDER, isTerminalStatus } from "../pipeline.js";

describe("pipeline helpers", () => {
  it("active pipeline order excludes both terminal statuses", () => {
    expect(ACTIVE_PIPELINE_ORDER).not.toContain("won");
    expect(ACTIVE_PIPELINE_ORDER).not.toContain("lost");
    expect(ACTIVE_PIPELINE_ORDER).toHaveLength(5);
  });

  it("isTerminalStatus is true only for won/lost", () => {
    expect(isTerminalStatus("won")).toBe(true);
    expect(isTerminalStatus("lost")).toBe(true);
    expect(isTerminalStatus("new")).toBe(false);
    expect(isTerminalStatus("negotiation")).toBe(false);
  });
});
