"use client";

// Drawer (doc 10 Grupo C). Painel lateral para detalhe/edição sem perder
// contexto. 420–560px, full-width em mobile.

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { drawerMotion } from "@shina/motion";
import { cn } from "../utils/cn";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: "left" | "right";
  className?: string;
}

export function Drawer({ open, onClose, title, children, side = "right", className }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-modal">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[var(--shina-surface-overlay)]"
            onClick={onClose}
            {...drawerMotion.scrim}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "absolute top-0 bottom-0 w-full sm:w-[480px] p-6 overflow-y-auto",
              "bg-[var(--shina-surface-background)] border-[var(--shina-border-default)]",
              side === "right" ? "right-0 border-l" : "left-0 border-r",
              className,
            )}
            {...(side === "right" ? drawerMotion.panelRight : drawerMotion.panelLeft)}
          >
            <h2 className="text-base font-bold text-[var(--shina-text-title)] mb-4">{title}</h2>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
