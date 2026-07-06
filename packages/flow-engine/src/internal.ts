"use client";

// Utilidades internas do Flow Engine.

import { useEffect, useState } from "react";
import { createTheme, type ThemeProduct } from "@shina/tokens";

/** true quando o usuário prefere movimento reduzido (doc 18 §1). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function productAccent(product: ThemeProduct = "platform") {
  const theme = createTheme({ product });
  return {
    primary: theme.color.primary,
    accent: theme.color.accent,
    gradient: theme.gradient,
    glow: theme.glow,
  };
}

let keyframesInjected = false;

/** Injeta os keyframes globais do Flow Engine uma única vez. */
export function ensureKeyframes(): void {
  if (keyframesInjected || typeof document === "undefined") return;
  keyframesInjected = true;
  const style = document.createElement("style");
  style.dataset.shinaFlow = "keyframes";
  style.textContent = `
@keyframes shina-aurora-a { 0%{transform:translate(0,0)} 50%{transform:translate(6%,4%)} 100%{transform:translate(0,0)} }
@keyframes shina-aurora-b { 0%{transform:translate(0,0)} 50%{transform:translate(-5%,-3%)} 100%{transform:translate(0,0)} }
@keyframes shina-glow-pulse { 0%{opacity:.65} 50%{opacity:1} 100%{opacity:.65} }
@keyframes shina-flow-dash { to { stroke-dashoffset: -200; } }
@keyframes shina-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
@keyframes shina-node-pulse { 0%,100%{opacity:.35} 50%{opacity:1} }
@keyframes shina-caret { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes shina-success-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
@media (prefers-reduced-motion: reduce) {
  [data-shina-flow] * { animation: none !important; }
}
`;
  document.head.appendChild(style);
}
