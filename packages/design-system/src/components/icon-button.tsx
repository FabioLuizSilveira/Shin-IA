"use client";

// IconButton (doc 10 Grupo A). Ação sem texto; aria-label obrigatório.

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  "aria-label": string;
  size?: "sm" | "md";
}

const SIZE_CLASSES = { sm: "w-8 h-8", md: "w-9 h-9" } as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, size = "md", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-[var(--shina-text-secondary)]",
        "hover:text-white hover:bg-[var(--shina-surface-glass-hover)] transition-colors duration-fast",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shina-border-focus)]",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
