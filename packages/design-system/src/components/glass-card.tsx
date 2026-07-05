"use client";

// GlassCard (doc 10/19 Grupo B/2). Superfície padrão de conteúdo.

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export type GlassCardRing = "none" | "warning" | "success" | "accent";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 1 | 2;
  interactive?: boolean;
  ring?: GlassCardRing;
}

const RING_CLASSES: Record<GlassCardRing, string> = {
  none: "",
  warning: "ring-1 ring-amber-500/40",
  success: "ring-1 ring-emerald-500/40",
  accent: "ring-1 ring-[var(--shina-primary)]/40",
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { elevation = 1, interactive, ring = "none", className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl p-6 border transition-colors duration-fast",
        elevation === 1
          ? "bg-[var(--shina-surface-glass)] border-[var(--shina-border-default)]"
          : "bg-[var(--shina-surface-glass-hover)] border-[var(--shina-border-strong)]",
        interactive &&
          "hover:-translate-y-0.5 hover:border-[var(--shina-border-strong)] cursor-pointer",
        RING_CLASSES[ring],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
