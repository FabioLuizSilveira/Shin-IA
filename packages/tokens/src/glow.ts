// Shinã Flow — glow tokens (doc 04 §6, doc 08 §3)
// Glow é atmosfera: sempre atrás do conteúdo, máx. 1 dominante por viewport.

import { blue, purple } from "./colors";

export interface GlowToken {
  color: string;
  /** opacidade do centro (0–1) */
  opacity: number;
  /** blur mínimo em px */
  blur: number;
  /** css radial-gradient pronto */
  css: string;
}

function radial(color: string, opacity: number): string {
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `radial-gradient(circle, ${color}${alpha} 0%, transparent 70%)`;
}

export const glow = {
  platform: { color: blue[600], opacity: 0.1, blur: 64, css: radial(blue[600], 0.1) },
  mkt: { color: purple[500], opacity: 0.1, blur: 64, css: radial(purple[500], 0.1) },
  accent: { color: purple[400], opacity: 0.08, blur: 64, css: radial(purple[400], 0.08) },
} as const satisfies Record<string, GlowToken>;
