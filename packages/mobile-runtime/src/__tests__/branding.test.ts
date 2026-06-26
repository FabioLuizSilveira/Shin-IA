import { describe, it, expect, beforeEach } from "vitest";
import { MobileBrandingRuntime } from "../branding.js";
import { MobileRuntimeError } from "../offline-sync.js";
import type { MobileBranding } from "../types.js";

function makeBranding(tenantId = "t1"): MobileBranding {
  return {
    tenantId,
    primaryColor: "#ff0000",
    secondaryColor: "#00ff00",
    appName: "Acme App",
  };
}

describe("MobileBrandingRuntime", () => {
  let runtime: MobileBrandingRuntime;

  beforeEach(() => {
    runtime = new MobileBrandingRuntime();
  });

  describe("register / resolveBranding", () => {
    it("registers and resolves branding", () => {
      runtime.register(makeBranding());
      const branding = runtime.resolveBranding("t1");
      expect(branding.primaryColor).toBe("#ff0000");
      expect(branding.appName).toBe("Acme App");
    });

    it("merges with defaults", () => {
      runtime.register(makeBranding());
      const branding = runtime.resolveBranding("t1");
      expect(branding.fontFamily).toBe("System");
    });

    it("throws BRANDING_NOT_FOUND for unknown tenant", () => {
      expect(() => runtime.resolveBranding("unknown")).toThrow(MobileRuntimeError);
    });
  });

  describe("isCustomBranded", () => {
    it("returns true for registered tenant", () => {
      runtime.register(makeBranding());
      expect(runtime.isCustomBranded("t1")).toBe(true);
    });

    it("returns false for unregistered tenant", () => {
      expect(runtime.isCustomBranded("unknown")).toBe(false);
    });
  });

  describe("mergeBranding", () => {
    it("overrides specific fields", () => {
      runtime.register(makeBranding());
      const merged = runtime.mergeBranding("t1", { primaryColor: "#000000" });
      expect(merged.primaryColor).toBe("#000000");
      expect(merged.appName).toBe("Acme App");
    });

    it("preserves tenantId", () => {
      runtime.register(makeBranding());
      const merged = runtime.mergeBranding("t1", {});
      expect(merged.tenantId).toBe("t1");
    });

    it("throws for unregistered tenant", () => {
      expect(() => runtime.mergeBranding("unknown", {})).toThrow(MobileRuntimeError);
    });
  });

  describe("unregister", () => {
    it("removes branding", () => {
      runtime.register(makeBranding());
      runtime.unregister("t1");
      expect(runtime.isCustomBranded("t1")).toBe(false);
    });

    it("throws BRANDING_NOT_FOUND for unknown tenant", () => {
      expect(() => runtime.unregister("unknown")).toThrow(MobileRuntimeError);
    });
  });

  describe("listAll", () => {
    it("returns all registered brandings", () => {
      runtime.register(makeBranding("t1"));
      runtime.register(makeBranding("t2"));
      expect(runtime.listAll()).toHaveLength(2);
    });

    it("returns empty for no registrations", () => {
      expect(runtime.listAll()).toHaveLength(0);
    });
  });

  describe("computeCssTokens", () => {
    it("returns primary and secondary tokens", () => {
      runtime.register(makeBranding());
      const tokens = runtime.computeCssTokens("t1");
      expect(tokens["--primary"]).toBe("#ff0000");
      expect(tokens["--secondary"]).toBe("#00ff00");
    });

    it("includes logo url when present", () => {
      runtime.register({ ...makeBranding(), logoUrl: "https://example.com/logo.png" });
      const tokens = runtime.computeCssTokens("t1");
      expect(tokens["--logo"]).toBe("https://example.com/logo.png");
    });

    it("omits logo url when absent", () => {
      runtime.register(makeBranding());
      const tokens = runtime.computeCssTokens("t1");
      expect(tokens["--logo"]).toBeUndefined();
    });
  });
});
