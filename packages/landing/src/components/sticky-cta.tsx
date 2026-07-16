"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface StickyCtaProps {
  children: ReactNode;
  /** px de scroll antes de aparecer */
  showAfter?: number;
}

/** Barra fixa que aparece após o usuário rolar (doc 10). Discreta, sem bounce. */
export function StickyCta({ children, showAfter = 400 }: StickyCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > showAfter);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfter]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-header p-4 bg-[var(--shina-surface-background)]/90 backdrop-blur-md border-t border-[var(--shina-border-subtle)]">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">{children}</div>
    </div>
  );
}
