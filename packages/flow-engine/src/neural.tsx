"use client";

// Presença de IA (doc 12): partículas neurais, loader, indicador de estado
// e Glow Pulse. Sem spinners, sem robôs — nós, conexões e luz.

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { type ThemeProduct } from "@shina/tokens";
import { ensureKeyframes, productAccent, useReducedMotion } from "./internal";

// Posições determinísticas (constelação estável entre renders)
const NODE_POSITIONS = [
  [20, 30],
  [45, 15],
  [70, 35],
  [85, 60],
  [60, 75],
  [30, 65],
  [50, 45],
  [15, 80],
  [80, 20],
  [90, 85],
  [10, 50],
  [65, 10],
  [35, 90],
  [75, 70],
  [25, 10],
  [55, 85],
  [5, 25],
  [95, 45],
  [40, 55],
  [88, 8],
] as const;

export interface NeuralParticlesProps {
  product?: ThemeProduct;
  /** máx. 20 */
  nodes?: number;
  connections?: boolean;
  mode?: "idle" | "thinking";
  className?: string;
  size?: number;
}

/** Constelação de nós; em `thinking`, as arestas pulsam em sequência. */
export function NeuralParticles({
  product = "platform",
  nodes = 7,
  connections = true,
  mode = "idle",
  className,
  size = 120,
}: NeuralParticlesProps) {
  useEffect(ensureKeyframes, []);
  const { accent } = productAccent(product);
  const n = Math.min(nodes, 20);
  const points = NODE_POSITIONS.slice(0, n);

  return (
    <svg
      aria-hidden
      data-shina-flow="neural"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
    >
      {connections &&
        points.slice(1).map(([x, y], i) => {
          const [px, py] = points[i];
          return (
            <line
              key={i}
              x1={px}
              y1={py}
              x2={x}
              y2={y}
              stroke={accent}
              strokeWidth={0.6}
              opacity={mode === "thinking" ? undefined : 0.25}
              style={
                mode === "thinking"
                  ? {
                      animation: `shina-node-pulse 1.8s linear infinite`,
                      animationDelay: `${i * 0.15}s`,
                    }
                  : undefined
              }
            />
          );
        })}
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={1.8}
          fill={accent}
          style={
            mode === "thinking"
              ? {
                  animation: `shina-node-pulse 1.8s linear infinite`,
                  animationDelay: `${i * 0.12}s`,
                }
              : { opacity: 0.7 }
          }
        />
      ))}
    </svg>
  );
}

export interface GlowPulseProps {
  product?: ThemeProduct;
  active?: boolean;
  children: ReactNode;
  className?: string;
}

/** Envolve um elemento com a respiração-base da IA (Glow Pulse 4s). */
export function GlowPulse({
  product = "platform",
  active = true,
  children,
  className,
}: GlowPulseProps) {
  useEffect(ensureKeyframes, []);
  const { glow } = productAccent(product);
  const style: CSSProperties = { position: "relative", display: "inline-block" };
  const glowStyle: CSSProperties = {
    position: "absolute",
    inset: "-40%",
    borderRadius: "50%",
    background: glow?.css ?? "none",
    filter: "blur(24px)",
    pointerEvents: "none",
    animation: active ? "shina-glow-pulse 4s ease-in-out infinite" : "none",
    opacity: active ? 1 : 0.5,
  };
  return (
    <span data-shina-flow="glow-pulse" className={className} style={style}>
      <span aria-hidden style={glowStyle} />
      <span style={{ position: "relative" }}>{children}</span>
    </span>
  );
}

export interface NeuralLoaderProps {
  product?: ThemeProduct;
  label?: string;
  size?: number;
  className?: string;
}

/** Loader oficial de IA (doc 14) — nunca spinner. */
export function NeuralLoader({
  product = "platform",
  label,
  size = 40,
  className,
}: NeuralLoaderProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-shina-flow="neural-loader"
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <NeuralParticles product={product} nodes={5} mode="thinking" size={size} />
      {label && <span>{label}</span>}
    </span>
  );
}

export type AISubstate = "thinking" | "searching" | "connecting" | "planning";

const SUBSTATE_LABELS: Record<AISubstate, string> = {
  thinking: "Pensando…",
  searching: "Buscando…",
  connecting: "Conectando…",
  planning: "Planejando…",
};

export interface ThinkingIndicatorProps {
  product?: ThemeProduct;
  substate?: AISubstate;
  label?: string;
  onCancel?: () => void;
  className?: string;
}

/** Indicador compacto do estado Thinking (doc 12) com Cancelar opcional. */
export function ThinkingIndicator({
  product = "platform",
  substate = "thinking",
  label,
  onCancel,
  className,
}: ThinkingIndicatorProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-shina-flow="thinking"
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <GlowPulse product={product}>
        <NeuralParticles product={product} nodes={5} mode="thinking" size={20} />
      </GlowPulse>
      <span>{label ?? SUBSTATE_LABELS[substate]}</span>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "none",
            border: 0,
            cursor: "pointer",
            textDecoration: "underline",
            color: "inherit",
            font: "inherit",
          }}
        >
          Cancelar
        </button>
      )}
    </span>
  );
}

export interface StreamingTextProps {
  text: string;
  /** ms por palavra (doc 11: 80) */
  wordIntervalMs?: number;
  onDone?: () => void;
  className?: string;
  product?: ThemeProduct;
}

import { useState } from "react";

/** Texto surgindo por palavra com caret de gradiente (doc 12 Streaming). */
export function StreamingText({
  text,
  wordIntervalMs = 80,
  onDone,
  className,
  product = "platform",
}: StreamingTextProps) {
  useEffect(ensureKeyframes, []);
  const reduced = useReducedMotion();
  const words = text.split(/(\s+)/);
  const [visible, setVisible] = useState(reduced ? words.length : 0);
  const { gradient } = productAccent(product);

  useEffect(() => {
    if (reduced) {
      setVisible(words.length);
      onDone?.();
      return;
    }
    if (visible >= words.length) {
      onDone?.();
      return;
    }
    const timer = setTimeout(() => setVisible((v) => v + 1), wordIntervalMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced, words.length, wordIntervalMs]);

  const done = visible >= words.length;

  return (
    <span aria-live="polite" data-shina-flow="streaming" className={className}>
      {words.slice(0, visible).join("")}
      {!done && (
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 2,
            height: "1em",
            verticalAlign: "text-bottom",
            marginLeft: 1,
            background: gradient.css,
            animation: "shina-caret 1s ease-in-out infinite",
          }}
        />
      )}
    </span>
  );
}
