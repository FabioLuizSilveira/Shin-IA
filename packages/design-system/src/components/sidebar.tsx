"use client";

// FloatingSidebar (doc 10 Grupo D / doc 19). Navegação primária destacada.

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface SidebarItem {
  href: string;
  label: string;
  icon: ReactNode;
}

export interface FloatingSidebarProps {
  items: SidebarItem[];
  active: string;
  header?: ReactNode;
  footer?: ReactNode;
  /** navega sem depender de next/link — apps injetam seu próprio router */
  renderLink?: (item: SidebarItem, children: ReactNode) => ReactNode;
  className?: string;
}

export function FloatingSidebar({
  items,
  active,
  header,
  footer,
  renderLink,
  className,
}: FloatingSidebarProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "flex flex-col w-60 shrink-0 h-full rounded-xl m-3",
        "bg-[var(--shina-surface-glass)] backdrop-blur-md border border-[var(--shina-border-default)]",
        className,
      )}
    >
      {header && <div className="p-4 border-b border-[var(--shina-border-subtle)]">{header}</div>}

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => {
          const isActive = active.startsWith(item.href);
          const content = (
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-fast",
                isActive
                  ? "bg-[var(--shina-primary)]/15 text-[var(--shina-accent)]"
                  : "text-[var(--shina-text-secondary)] hover:text-white hover:bg-[var(--shina-surface-glass-hover)]",
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {item.label}
            </span>
          );
          return (
            <div key={item.href} aria-current={isActive ? "page" : undefined}>
              {renderLink ? renderLink(item, content) : <a href={item.href}>{content}</a>}
            </div>
          );
        })}
      </div>

      {footer && <div className="p-3 border-t border-[var(--shina-border-subtle)]">{footer}</div>}
    </nav>
  );
}
