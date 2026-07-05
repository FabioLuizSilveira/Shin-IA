// Shinã Flow — motion físico (doc 11 §2). Springs firmes, overshoot ≤ 2%.

import { durations } from "./durations";
import { easing, easingArray } from "./easing";

export const springs = {
  /** padrão de UI: botões, cards, popovers */
  default: { type: "spring", stiffness: 260, damping: 30, mass: 1 },
  /** painéis pesados: drawers, modais */
  heavy: { type: "spring", stiffness: 210, damping: 34, mass: 1.4 },
  /** micro-feedback: pressed, toggles */
  snappy: { type: "spring", stiffness: 400, damping: 32, mass: 0.8 },
} as const;

export const motionRules = {
  /** stagger entre itens de lista (ms) */
  staggerMs: 20,
  /** teto de itens animados em stagger */
  staggerCap: 8,
  /** saídas rodam a ×0.7 da duração de entrada */
  exitRatio: 0.7,
  /** deslocamento máx. de entrada (px) */
  enterDistance: 12,
  /** escala máxima em hover */
  hoverScaleMax: 1.01,
  /** fade por palavra no streaming (ms) */
  streamingWordMs: 80,
} as const;

export const motion = { durations, easing, easingArray, springs, rules: motionRules } as const;
