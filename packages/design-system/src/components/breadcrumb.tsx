"use client";

import { ChevronRight } from "@shina/icons";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  renderLink?: (item: BreadcrumbItem, children: ReactNode) => ReactNode;
}

export function Breadcrumb({ items, renderLink }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-[var(--shina-text-tertiary)]"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const label =
          isLast || !item.href ? (
            <span className={isLast ? "text-white font-medium" : undefined}>{item.label}</span>
          ) : renderLink ? (
            renderLink(item, item.label)
          ) : (
            <a href={item.href} className="hover:text-white">
              {item.label}
            </a>
          );
        return (
          <span key={i} className="flex items-center gap-1.5">
            {label}
            {!isLast && <ChevronRight size={12} />}
          </span>
        );
      })}
    </nav>
  );
}
