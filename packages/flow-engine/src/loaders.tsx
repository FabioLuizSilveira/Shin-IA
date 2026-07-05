"use client";

// Loaders do doc 14 — Skeleton (shimmer) e Flow Loader. Spinner é proibido.

import { useEffect, type CSSProperties } from "react";
import { surface, radius, type ThemeProduct } from "@shina/tokens";
import { ensureKeyframes, productAccent } from "./internal";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  rounded?: keyof typeof radius;
  className?: string;
}

/** Skeleton com shimmer direcional (nunca piscando). */
export function Skeleton({
  width = "100%",
  height = 16,
  rounded = "md",
  className,
}: SkeletonProps) {
  useEffect(ensureKeyframes, []);
  const style: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    width,
    height,
    borderRadius: radius[rounded],
    background: surface.glass,
  };
  const shimmer: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
    animation: "shina-shimmer 1.5s linear infinite",
  };
  return (
    <span aria-hidden data-shina-flow="skeleton" className={className} style={style}>
      <span style={shimmer} />
    </span>
  );
}

export interface FlowLoaderProps {
  product?: ThemeProduct;
  height?: number;
  className?: string;
  label?: string;
}

/** Barra de fluxo indeterminada — um segmento de gradiente flui pelo trilho. */
export function FlowLoader({
  product = "platform",
  height = 3,
  className,
  label,
}: FlowLoaderProps) {
  useEffect(ensureKeyframes, []);
  const { gradient } = productAccent(product);
  return (
    <span
      role="progressbar"
      aria-label={label ?? "Carregando"}
      data-shina-flow="flow-loader"
      className={className}
      style={{
        position: "relative",
        display: "block",
        height,
        borderRadius: 9999,
        background: surface.glass,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "35%",
          borderRadius: 9999,
          background: gradient.css,
          animation: "shina-shimmer 1.5s linear infinite",
        }}
      />
    </span>
  );
}
