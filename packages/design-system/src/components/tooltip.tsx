"use client";

// Tooltip (doc 10 Grupo C). Delay 300ms, fade+translate 4px, sem ação dentro.

import { useState, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface TooltipProps {
  content: string;
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

export function Tooltip({ content, children, delayMs = 300, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  function show() {
    timer.current = setTimeout(() => setVisible(true), delayMs);
  }
  function hide() {
    clearTimeout(timer.current);
    setVisible(false);
  }

  return (
    <span
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-dropdown bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5",
            "rounded-md text-xs whitespace-nowrap",
            "bg-[var(--shina-surface-raised)] text-[var(--shina-text-primary)]",
            "border border-[var(--shina-border-default)]",
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
