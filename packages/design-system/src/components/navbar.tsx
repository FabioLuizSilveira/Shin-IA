"use client";

// FloatingNavbar (doc 10 Grupo D). Barra superior fixa com blur.

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface FloatingNavbarProps {
  left: ReactNode;
  right?: ReactNode;
  floating?: boolean;
  className?: string;
}

export function FloatingNavbar({ left, right, floating, className }: FloatingNavbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-header flex items-center justify-between h-16 px-6",
        "bg-[var(--shina-surface-background)]/80 backdrop-blur-md border-b border-[var(--shina-border-subtle)]",
        floating && "mx-4 mt-3 rounded-full border shadow-md",
        className,
      )}
    >
      <div className="flex items-center gap-3">{left}</div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  );
}
