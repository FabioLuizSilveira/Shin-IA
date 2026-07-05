"use client";

// Button (doc 10 Grupo A). Um primário por dobra; verbo no label.

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { NeuralLoader } from "@shina/flow-engine";
import type { ThemeProduct } from "@shina/tokens";
import { cn } from "../utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "gradient";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  product?: ThemeProduct;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--shina-primary)] hover:bg-[var(--shina-primary-hover)] text-white border-transparent",
  secondary:
    "bg-transparent hover:bg-[var(--shina-surface-glass-hover)] text-[var(--shina-text-primary)] border-[var(--shina-border-default)]",
  ghost:
    "bg-transparent hover:bg-[var(--shina-surface-glass-hover)] text-[var(--shina-text-secondary)] border-transparent",
  danger: "bg-transparent hover:bg-red-500/10 text-red-400 border-red-500/30",
  gradient: "text-white border-transparent bg-[image:var(--shina-gradient)]",
};

/**
 * Ação primária/secundária do sistema. `loading` substitui o label por um
 * NeuralLoader — nunca um spinner (doc 12/14).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    icon,
    product,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-semibold transition-colors duration-fast",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shina-border-focus)]",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {loading ? <NeuralLoader product={product} size={16} /> : icon}
      {children}
    </button>
  );
});
