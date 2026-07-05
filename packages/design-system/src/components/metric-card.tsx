"use client";

// MetricCard (doc 10/19 Grupo C/3). Um KPI, uma leitura instantânea.

import type { ReactNode } from "react";
import { MetricCounter } from "@shina/flow-engine";
import { TrendingUp, TrendingDown } from "@shina/icons";
import { GlassCard } from "./glass-card";
import { cn } from "../utils/cn";

export interface MetricCardProps {
  label: string;
  value: number;
  format?: (value: number) => string;
  delta?: number;
  icon: ReactNode;
  href?: string;
  attention?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  format,
  delta,
  icon,
  href,
  attention,
  className,
}: MetricCardProps) {
  const content = (
    <GlassCard
      interactive={Boolean(href)}
      ring={attention ? "warning" : "none"}
      className={cn("p-5", className)}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--shina-text-secondary)]">{label}</span>
        <span className="text-[var(--shina-accent)]">{icon}</span>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-black text-[var(--shina-text-title)]">
          <MetricCounter value={value} format={format} />
        </p>
        {typeof delta === "number" && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-semibold",
              delta >= 0 ? "text-emerald-400" : "text-red-400",
            )}
          >
            {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </GlassCard>
  );

  return href ? (
    <a href={href} className="no-underline block">
      {content}
    </a>
  ) : (
    content
  );
}
