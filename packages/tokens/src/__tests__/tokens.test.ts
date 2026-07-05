import { describe, it, expect } from "vitest";
import {
  blue,
  purple,
  cyan,
  gray,
  spacing,
  radius,
  zIndex,
  durations,
  typography,
  gradients,
  createTheme,
  chartColors,
} from "../index";

describe("brand lock (doc 02) — âncoras imutáveis", () => {
  it("mantém as cores oficiais da marca", () => {
    expect(blue[600]).toBe("#2563EB");
    expect(cyan[500]).toBe("#06B6D4");
    expect(purple[500]).toBe("#6366F1");
    expect(purple[700]).toBe("#8B5CF6");
    expect(purple[400]).toBe("#A78BFA");
    expect(gray[900]).toBe("#0F172A");
    expect(gray[950]).toBe("#020617");
    expect(gray[200]).toBe("#E2E8F0");
    expect(gray[500]).toBe("#64748B");
  });

  it("gradientes oficiais a 135°", () => {
    expect(gradients.platform.css).toBe("linear-gradient(135deg, #2563EB, #06B6D4)");
    expect(gradients.mkt.css).toBe("linear-gradient(135deg, #6366F1, #8B5CF6)");
    expect(gradients.platform.angle).toBe(135);
  });
});

describe("escalas", () => {
  it("spacing é múltiplo de 4", () => {
    for (const value of Object.values(spacing)) {
      expect(value % 4).toBe(0);
    }
  });

  it("radius e z-index seguem o doc 06", () => {
    expect(radius.lg).toBe(16);
    expect(zIndex.toast).toBe(100);
    expect(zIndex.modal).toBeLessThan(zIndex.toast);
  });

  it("durações do doc 11", () => {
    expect(durations.fast).toBe(150);
    expect(durations.base).toBe(250);
    expect(durations.slow).toBe(400);
  });

  it("tipografia tem 16 estilos e body 14px", () => {
    expect(Object.keys(typography)).toHaveLength(16);
    expect(typography.body.size).toBe(14);
    expect(typography.displayXXL.responsive?.sm).toBe(40);
  });

  it("sequência de gráficos tem 7 cores", () => {
    expect(chartColors).toHaveLength(7);
  });
});

describe("createTheme", () => {
  it("dark platform é o padrão", () => {
    const t = createTheme();
    expect(t.mode).toBe("dark");
    expect(t.product).toBe("platform");
    expect(t.color.primary).toBe("#2563EB");
    expect(t.surface.background).toBe("#0F172A");
    expect(t.glow).not.toBeNull();
  });

  it("mkt usa índigo e glow próprio", () => {
    const t = createTheme({ product: "mkt" });
    expect(t.color.primary).toBe("#6366F1");
    expect(t.gradient.from).toBe("#6366F1");
    expect(t.glow?.color).toBe("#6366F1");
  });

  it("light elimina glow (doc 04 §9)", () => {
    const t = createTheme({ mode: "light" });
    expect(t.glow).toBeNull();
    expect(t.surface.background).toBe("#FFFFFF");
    expect(t.color.text.primary).toBe("#0F172A");
  });
});
