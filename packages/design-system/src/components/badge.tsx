import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--shina-surface-glass)] text-[var(--shina-text-secondary)]",
  success: "bg-[var(--shina-success-bg)] text-[var(--shina-success-text)]",
  warning: "bg-[var(--shina-warning-bg)] text-[var(--shina-warning-text)]",
  danger: "bg-[var(--shina-danger-bg)] text-[var(--shina-danger-text)]",
  info: "bg-[var(--shina-info-bg)] text-[var(--shina-info-text)]",
};

/** Pill semântico (doc 10 Badge). Nunca sólido saturado. */
export function Badge({ variant = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
