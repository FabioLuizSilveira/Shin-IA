"use client";

// Fundos oficiais do Flow Engine (doc 16). Todos aria-hidden, GPU-friendly,
// estáticos em prefers-reduced-motion e limitados a 1 efeito dominante.

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { blur as blurTokens, gray, type ThemeProduct } from "@shina/tokens";
import { ensureKeyframes, productAccent } from "./internal";

const layer: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

export interface AuroraMeshProps {
  product?: ThemeProduct;
  /** 0–1 — multiplica a opacidade dos glows */
  intensity?: number;
  className?: string;
}

/** Aurora: 2 glows da marca transladando lentamente (doc 16 Aurora). */
export function AuroraMesh({ product = "platform", intensity = 1, className }: AuroraMeshProps) {
  useEffect(ensureKeyframes, []);
  const { primary, accent } = productAccent(product);
  const glowStyle = (color: string, anim: string, pos: CSSProperties): CSSProperties => ({
    position: "absolute",
    width: "60%",
    height: "60%",
    borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    opacity: 0.1 * intensity,
    filter: `blur(${blurTokens.aurora}px)`,
    animation: `${anim} 12s linear infinite`,
    ...pos,
  });

  return (
    <div aria-hidden data-shina-flow="aurora" className={className} style={layer}>
      <div style={glowStyle(primary, "shina-aurora-a", { top: "-10%", left: "10%" })} />
      <div style={glowStyle(accent, "shina-aurora-b", { bottom: "-15%", right: "5%" })} />
    </div>
  );
}

export interface FlowLinesProps {
  product?: ThemeProduct;
  /** máx. 5 (doc 16) */
  count?: number;
  opacity?: number;
  className?: string;
}

/** Linhas de fluxo finíssimas com dash animado (doc 16 Flow). */
export function FlowLines({
  product = "platform",
  count = 3,
  opacity = 0.08,
  className,
}: FlowLinesProps) {
  useEffect(ensureKeyframes, []);
  const { accent } = productAccent(product);
  const lines = Math.min(count, 5);

  return (
    <div aria-hidden data-shina-flow="flow-lines" className={className} style={layer}>
      <svg width="100%" height="100%" viewBox="0 0 1200 600" preserveAspectRatio="none">
        {Array.from({ length: lines }, (_, i) => {
          const y = 100 + (i * 400) / Math.max(lines - 1, 1);
          return (
            <path
              key={i}
              d={`M -50 ${y} C 300 ${y - 80}, 600 ${y + 80}, 1250 ${y - 40}`}
              fill="none"
              stroke={accent}
              strokeWidth={1}
              strokeDasharray="6 14"
              opacity={Math.min(opacity, 0.08)}
              style={{ animation: `shina-flow-dash ${6 + i}s linear infinite` }}
            />
          );
        })}
      </svg>
    </div>
  );
}

export interface FlowBackgroundProps {
  variant?: "dashboard" | "aurora" | "flow" | "hero";
  product?: ThemeProduct;
  intensity?: number;
  children?: ReactNode;
  className?: string;
}

/**
 * Fundo ambiente oficial (doc 16). `dashboard` é chapado e quieto;
 * `aurora`/`flow` adicionam um único efeito; `hero` = aurora + flow discreto.
 */
export function FlowBackground({
  variant = "dashboard",
  product = "platform",
  intensity = 1,
  children,
  className,
}: FlowBackgroundProps) {
  const base: CSSProperties = {
    position: "relative",
    background: variant === "dashboard" ? gray[900] : gray[950],
  };

  return (
    <div data-shina-flow="background" className={className} style={base}>
      {variant !== "dashboard" && <AuroraMesh product={product} intensity={intensity} />}
      {(variant === "flow" || variant === "hero") && (
        <FlowLines product={product} count={variant === "hero" ? 3 : 4} />
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
