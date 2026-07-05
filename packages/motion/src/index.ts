// @shina/motion — Motion Library oficial (doc 11).
// Presets são dados compatíveis com Framer Motion (variants/transitions),
// mas não dependem dele em runtime: qualquer camada pode consumi-los.
// Regra: nenhuma tela define animação própria — tudo vem daqui.

import { durations, easingArray, springs, motionRules } from "@shina/tokens";

export { durations, easingArray, springs, motionRules };

type Ease = readonly [number, number, number, number];

const outEase = easingArray.out as unknown as Ease;
const inEase = easingArray.in as unknown as Ease;
const inOutEase = easingArray.inOut as unknown as Ease;

const s = (ms: number) => ms / 1000;

// ── Transitions básicas ────────────────────────────────────────────────────────

export const transitions = {
  instant: { duration: s(durations.instant), ease: outEase },
  fast: { duration: s(durations.fast), ease: outEase },
  base: { duration: s(durations.base), ease: outEase },
  slow: { duration: s(durations.slow), ease: outEase },
  exit: { duration: s(durations.base * motionRules.exitRatio), ease: inEase },
  morph: { duration: s(durations.base), ease: inOutEase },
  spring: springs.default,
  springHeavy: springs.heavy,
  springSnappy: springs.snappy,
} as const;

// ── Variants fundamentais (initial / animate / exit) ──────────────────────────

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.exit },
} as const;

export const slideUp = {
  initial: { opacity: 0, y: motionRules.enterDistance },
  animate: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, y: 4, transition: transitions.exit },
} as const;

export const scaleIn = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: transitions.base },
  exit: { opacity: 0, scale: 0.98, transition: transitions.exit },
} as const;

export const reveal = {
  initial: { clipPath: "inset(0 100% 0 0)" },
  animate: {
    clipPath: "inset(0 0% 0 0)",
    transition: { duration: s(durations.slow), ease: inOutEase },
  },
} as const;

export const expand = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1, transition: transitions.spring },
  exit: { height: 0, opacity: 0, transition: transitions.exit },
} as const;

// ── Coreografia de listas (stagger 20ms, teto 8 — doc 11 §5) ──────────────────

export const staggerContainer = {
  animate: {
    transition: { staggerChildren: s(motionRules.staggerMs), staggerDirection: 1 },
  },
} as const;

export const staggerItem = slideUp;

/** Delay de stagger com teto: itens além do cap entram juntos. */
export function staggerDelay(index: number): number {
  return s(Math.min(index, motionRules.staggerCap) * motionRules.staggerMs);
}

// ── Presets por componente (doc 11 §6) ────────────────────────────────────────

export const hoverLift = {
  whileHover: { y: -2, transition: transitions.fast },
  whileTap: { scale: 0.99, transition: transitions.instant },
} as const;

export const dialogMotion = {
  scrim: fade,
  panel: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1, transition: transitions.spring },
    exit: { opacity: 0, scale: 0.98, transition: transitions.exit },
  },
} as const;

export const drawerMotion = {
  scrim: fade,
  panelRight: {
    initial: { x: "100%" },
    animate: { x: 0, transition: transitions.springHeavy },
    exit: { x: "100%", transition: transitions.exit },
  },
  panelLeft: {
    initial: { x: "-100%" },
    animate: { x: 0, transition: transitions.springHeavy },
    exit: { x: "-100%", transition: transitions.exit },
  },
} as const;

export const toastMotion = {
  initial: { opacity: 0, y: -motionRules.enterDistance },
  animate: { opacity: 1, y: 0, transition: transitions.spring },
  exit: { opacity: 0, transition: transitions.exit },
} as const;

export const tooltipMotion = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: transitions.fast },
  exit: { opacity: 0, transition: { duration: 0.08 } },
} as const;

export const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.exit },
} as const;

export const sidebarItemMotion = {
  whileHover: { backgroundColor: "rgba(255,255,255,0.05)", transition: transitions.fast },
} as const;

export const commandPaletteMotion = {
  scrim: fade,
  panel: {
    initial: { opacity: 0, y: -12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1, transition: transitions.base },
    exit: { opacity: 0, y: -8, transition: transitions.exit },
  },
} as const;

export const workspaceSwitchMotion = {
  content: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: transitions.base },
    exit: { opacity: 0, transition: transitions.exit },
  },
  /** o acento do produto transita em slow via CSS variables (theme) */
  accentDurationMs: durations.slow,
} as const;

export const chartMotion = {
  bar: (index: number) =>
    ({
      initial: { scaleY: 0, originY: 1 },
      animate: {
        scaleY: 1,
        transition: { ...transitions.base, delay: staggerDelay(index) },
      },
    }) as const,
  line: {
    initial: { pathLength: 0 },
    animate: { pathLength: 1, transition: { duration: s(durations.slow), ease: outEase } },
  },
} as const;

export const metricMotion = {
  /** duração da interpolação do Metric Counter */
  counterDurationMs: durations.slow,
} as const;

export const streamingMotion = {
  word: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: s(motionRules.streamingWordMs) } },
  },
  wordIntervalMs: motionRules.streamingWordMs,
} as const;

export const loadingMotion = {
  /** shimmer do skeleton: translateX loop */
  shimmerDurationMs: 1500,
  /** pulso de opacidade (Pulse Loader / Glow Pulse) */
  pulse: {
    animate: {
      opacity: [0.5, 1, 0.5],
      transition: { duration: 4, ease: "linear", repeat: Infinity },
    },
  },
} as const;
