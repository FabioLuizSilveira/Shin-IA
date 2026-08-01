"use client";

// Dialog / Modal (doc 10 Grupo C). Foco preso, Esc fecha (exceto destrutivo),
// scrim + painel glass. Motion vem de @shina/motion (dialogMotion).

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { dialogMotion } from "@shina/motion";
import { cn } from "../utils/cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** destrutivo: Esc/clique fora não fecham (exige decisão explícita) */
  destructive?: boolean;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  destructive,
  className,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !destructive) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, destructive, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[var(--shina-surface-overlay)]"
            onClick={destructive ? undefined : onClose}
            {...dialogMotion.scrim}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shina-dialog-title"
            tabIndex={-1}
            className={cn(
              "relative w-full max-w-lg rounded-xl p-6",
              "bg-[var(--shina-surface-glass)] backdrop-blur-md border border-[var(--shina-border-default)]",
              className,
            )}
            {...dialogMotion.panel}
          >
            <h2
              id="shina-dialog-title"
              className="text-lg font-bold text-[var(--shina-text-title)] mb-4"
            >
              {title}
            </h2>
            <div className="text-sm text-[var(--shina-text-secondary)]">{children}</div>
            {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
