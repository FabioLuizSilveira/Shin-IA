import { describe, it, expect } from "vitest";
import { decideCredentialSource } from "./gateway.js";
import { AiPolicyError } from "./types.js";

describe("decideCredentialSource", () => {
  describe("mode SHINA", () => {
    it("uses Shinã when the platform key is available", () => {
      expect(decideCredentialSource("SHINA", false, true, null, false)).toEqual({
        source: "SHINA",
        billingSource: "SHINA_CREDITS",
      });
    });

    it("errors when the platform key is missing, even if BYOK is configured", () => {
      expect(() => decideCredentialSource("SHINA", true, false, null, false)).toThrow(
        AiPolicyError,
      );
    });
  });

  describe("mode BYOK", () => {
    it("uses the workspace key when configured", () => {
      expect(decideCredentialSource("BYOK", true, true, null, false)).toEqual({
        source: "BYOK",
        billingSource: "EXTERNAL_PROVIDER",
      });
    });

    it("errors when no BYOK key exists, even if the Shinã platform key is available", () => {
      // This is the core "no silent fallback" guarantee: mode=BYOK must
      // never spend Shinã credits, no matter what's available.
      expect(() => decideCredentialSource("BYOK", false, true, null, false)).toThrow(AiPolicyError);
    });
  });

  describe("mode HYBRID, preferredSource=BYOK (default)", () => {
    it("uses BYOK when configured, regardless of fallback flag", () => {
      expect(decideCredentialSource("HYBRID", true, true, null, false)).toEqual({
        source: "BYOK",
        billingSource: "EXTERNAL_PROVIDER",
      });
    });

    it("falls back to Shinã only when allowShinaFallback is explicitly true", () => {
      expect(decideCredentialSource("HYBRID", false, true, "BYOK", true)).toEqual({
        source: "SHINA",
        billingSource: "SHINA_CREDITS",
      });
    });

    it("does NOT fall back to Shinã when allowShinaFallback is false — the item 8 guarantee", () => {
      expect(() => decideCredentialSource("HYBRID", false, true, "BYOK", false)).toThrow(
        AiPolicyError,
      );
    });

    it("errors when neither credential exists", () => {
      expect(() => decideCredentialSource("HYBRID", false, false, "BYOK", true)).toThrow(
        AiPolicyError,
      );
    });
  });

  describe("mode HYBRID, preferredSource=SHINA", () => {
    it("uses Shinã when available", () => {
      expect(decideCredentialSource("HYBRID", true, true, "SHINA", false)).toEqual({
        source: "SHINA",
        billingSource: "SHINA_CREDITS",
      });
    });

    it("falls back to BYOK when Shinã is unavailable — always allowed, never charges Shinã", () => {
      expect(decideCredentialSource("HYBRID", true, false, "SHINA", false)).toEqual({
        source: "BYOK",
        billingSource: "EXTERNAL_PROVIDER",
      });
    });

    it("errors when neither credential exists", () => {
      expect(() => decideCredentialSource("HYBRID", false, false, "SHINA", false)).toThrow(
        AiPolicyError,
      );
    });
  });
});
