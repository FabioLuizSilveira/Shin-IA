import { describe, it, expect } from "vitest";
import {
  transitions,
  fade,
  slideUp,
  scaleIn,
  staggerDelay,
  drawerMotion,
  chartMotion,
  streamingMotion,
} from "../index";

describe("motion presets (doc 11)", () => {
  it("durações convertidas para segundos", () => {
    expect(transitions.base.duration).toBe(0.25);
    expect(transitions.slow.duration).toBe(0.4);
  });

  it("saídas rodam a ×0.7 da entrada", () => {
    expect(transitions.exit.duration).toBeCloseTo(0.175);
  });

  it("entradas deslocam no máximo 12px", () => {
    expect(slideUp.initial.y).toBeLessThanOrEqual(12);
  });

  it("scale de entrada é 0.98 (overshoot proibido)", () => {
    expect(scaleIn.initial.scale).toBe(0.98);
  });

  it("stagger tem teto de 8 itens", () => {
    expect(staggerDelay(3)).toBeCloseTo(0.06);
    expect(staggerDelay(50)).toBe(staggerDelay(8));
  });

  it("drawer usa spring pesado", () => {
    expect(drawerMotion.panelRight.animate.transition.mass).toBe(1.4);
  });

  it("chart bar cresce da base com stagger", () => {
    const bar = chartMotion.bar(2);
    expect(bar.initial.scaleY).toBe(0);
    expect(bar.animate.transition.delay).toBeCloseTo(0.04);
  });

  it("streaming por palavra a 80ms", () => {
    expect(streamingMotion.wordIntervalMs).toBe(80);
  });

  it("fade não tem bounce (ease é curva, não spring elástico)", () => {
    expect(fade.animate.transition).not.toHaveProperty("bounce");
  });
});
