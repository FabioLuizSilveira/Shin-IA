"use client";

// Tabs (doc 10 Grupo D). Indicador desliza (shared layout simplificado via
// CSS transition); conteúdo troca por crossfade fast.

import { useState, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  className?: string;
}

export function Tabs({ items, defaultTab, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const activeItem = items.find((i) => i.id === active);

  return (
    <div className={className}>
      <div
        role="tablist"
        className="flex items-center gap-1 border-b border-[var(--shina-border-subtle)]"
      >
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active === item.id}
            onClick={() => setActive(item.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-fast",
              active === item.id
                ? "text-[var(--shina-accent)] border-[var(--shina-primary)]"
                : "text-[var(--shina-text-secondary)] hover:text-white border-transparent",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-4 animate-in fade-in duration-150">
        {activeItem?.content}
      </div>
    </div>
  );
}
