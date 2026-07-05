import { describe, it, expect } from "vitest";
import { themeToCssVariables, generateCss } from "../css-variables";
import { shinaPreset } from "../tailwind-preset";
import { createTheme } from "@shina/tokens";

describe("css variables", () => {
  it("gera variáveis com prefixo --shina-", () => {
    const vars = themeToCssVariables(createTheme());
    expect(vars["--shina-primary"]).toBe("#2563EB");
    expect(vars["--shina-surface-background"]).toBe("#0F172A");
    expect(vars["--shina-space-6"]).toBe("24px");
    expect(vars["--shina-radius-lg"]).toBe("16px");
    expect(vars["--shina-duration-base"]).toBe("250ms");
  });

  it("mkt muda primária e glow", () => {
    const vars = themeToCssVariables(createTheme({ product: "mkt" }));
    expect(vars["--shina-primary"]).toBe("#6366F1");
    expect(vars["--shina-glow"]).toContain("radial-gradient");
  });

  it("light zera glow", () => {
    const vars = themeToCssVariables(createTheme({ mode: "light" }));
    expect(vars["--shina-glow"]).toBe("none");
  });

  it("generateCss emite os 4 blocos", () => {
    const css = generateCss();
    expect(css).toContain(":root {");
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain('[data-product="mkt"]');
    expect(css).toContain('[data-theme="light"][data-product="mkt"]');
  });
});

describe("tailwind preset", () => {
  it("expõe aliases de marca compatíveis com os apps", () => {
    const colors = shinaPreset.theme.extend.colors;
    expect(colors.shina.blue).toBe("#2563EB");
    expect(colors.mkt.primary).toBe("#6366F1");
    expect(colors.mkt.glow).toBe("#A78BFA");
    expect(shinaPreset.darkMode).toBe("class");
  });
});
