import { describe, it, expect } from "vitest";
import {
  computeCssVariables,
  applyWhiteLabel,
  isWhiteLabelEnabled,
  mergeTheme,
} from "../../lib/theme.js";
import type { WhiteLabelTheme } from "../../lib/types.js";

function makeTheme(overrides: Partial<WhiteLabelTheme> = {}): WhiteLabelTheme {
  return {
    primaryColor: "#1a73e8",
    secondaryColor: "#fbbc04",
    companyName: "Acme Rentals",
    ...overrides,
  };
}

describe("computeCssVariables", () => {
  it("returns primary, secondary and company name variables", () => {
    const vars = computeCssVariables(makeTheme());
    expect(vars["--color-primary"]).toBe("#1a73e8");
    expect(vars["--color-secondary"]).toBe("#fbbc04");
    expect(vars["--company-name"]).toBe("Acme Rentals");
  });

  it("includes font-family when set", () => {
    const vars = computeCssVariables(makeTheme({ fontFamily: "Inter" }));
    expect(vars["--font-family"]).toBe("Inter");
  });

  it("omits font-family when not set", () => {
    const vars = computeCssVariables(makeTheme());
    expect(vars["--font-family"]).toBeUndefined();
  });

  it("includes logo-url when set", () => {
    const vars = computeCssVariables(makeTheme({ logoUrl: "https://example.com/logo.png" }));
    expect(vars["--logo-url"]).toBe("https://example.com/logo.png");
  });

  it("omits logo-url when not set", () => {
    const vars = computeCssVariables(makeTheme());
    expect(vars["--logo-url"]).toBeUndefined();
  });
});

describe("applyWhiteLabel", () => {
  it("returns a CSS string with variables", () => {
    const css = applyWhiteLabel(makeTheme());
    expect(css).toContain("--color-primary: #1a73e8;");
    expect(css).toContain("--color-secondary: #fbbc04;");
  });

  it("includes all defined variables", () => {
    const css = applyWhiteLabel(makeTheme({ fontFamily: "Roboto" }));
    expect(css).toContain("--font-family: Roboto;");
  });
});

describe("isWhiteLabelEnabled", () => {
  it("returns true when primary color and company name are set", () => {
    expect(isWhiteLabelEnabled(makeTheme())).toBe(true);
  });

  it("returns false when null", () => {
    expect(isWhiteLabelEnabled(null)).toBe(false);
  });

  it("returns false when undefined", () => {
    expect(isWhiteLabelEnabled(undefined)).toBe(false);
  });

  it("returns false when missing primaryColor", () => {
    expect(isWhiteLabelEnabled({ companyName: "Acme" })).toBe(false);
  });

  it("returns false when missing companyName", () => {
    expect(isWhiteLabelEnabled({ primaryColor: "#fff" })).toBe(false);
  });
});

describe("mergeTheme", () => {
  it("overrides specified fields", () => {
    const merged = mergeTheme(makeTheme(), { primaryColor: "#000" });
    expect(merged.primaryColor).toBe("#000");
    expect(merged.secondaryColor).toBe("#fbbc04");
  });

  it("keeps base fields when not overridden", () => {
    const merged = mergeTheme(makeTheme(), {});
    expect(merged.companyName).toBe("Acme Rentals");
  });
});
