import { describe, it, expect } from "vitest";
import { capModeToPlan } from "./policy.js";

describe("capModeToPlan", () => {
  it("keeps the workspace's chosen mode when the plan allows it", () => {
    expect(capModeToPlan("BYOK", true, true)).toBe("BYOK");
    expect(capModeToPlan("HYBRID", true, true)).toBe("HYBRID");
    expect(capModeToPlan("SHINA", true, true)).toBe("SHINA");
  });

  it("downgrades BYOK to SHINA when the plan revokes byokAllowed", () => {
    expect(capModeToPlan("BYOK", false, true)).toBe("SHINA");
  });

  it("downgrades HYBRID to BYOK when the plan revokes hybridAllowed but keeps byokAllowed", () => {
    expect(capModeToPlan("HYBRID", true, false)).toBe("BYOK");
  });

  it("downgrades HYBRID to SHINA when the plan revokes both byok and hybrid", () => {
    expect(capModeToPlan("HYBRID", false, false)).toBe("SHINA");
  });

  it("never touches SHINA mode — it has no BYOK/hybrid dependency to revoke", () => {
    expect(capModeToPlan("SHINA", false, false)).toBe("SHINA");
  });
});
