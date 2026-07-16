"use client";

// InsightCard (doc 10/19 Grupo D/4). Insight de IA com fonte e ação —
// nunca "Loading…"; usa a máquina de estados do @shina/flow-engine.

import type { ReactNode } from "react";
import { ThinkingIndicator, StreamingText } from "@shina/flow-engine";
import type { ThemeProduct } from "@shina/tokens";
import { GlassCard } from "./glass-card";

export type InsightState = "idle" | "thinking" | "streaming" | "done" | "error";

export interface InsightCardProps {
  title: string;
  content?: string;
  source?: string;
  action?: ReactNode;
  state: InsightState;
  onCancel?: () => void;
  product?: ThemeProduct;
}

export function InsightCard({
  title,
  content,
  source,
  action,
  state,
  onCancel,
  product,
}: InsightCardProps) {
  return (
    <GlassCard>
      <h4 className="text-sm font-bold text-[var(--shina-text-title)] mb-2">{title}</h4>

      {state === "thinking" && <ThinkingIndicator product={product} onCancel={onCancel} />}

      {state === "streaming" && content && (
        <p className="text-sm text-[var(--shina-text-secondary)]">
          <StreamingText text={content} product={product} />
        </p>
      )}

      {state === "done" && content && (
        <p className="text-sm text-[var(--shina-text-secondary)]">{content}</p>
      )}

      {state === "error" && (
        <p className="text-sm text-red-400">Não foi possível gerar o insight. Tente novamente.</p>
      )}

      {(source || action) && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--shina-border-subtle)]">
          {source && <span className="text-xs text-[var(--shina-text-tertiary)]">{source}</span>}
          {action}
        </div>
      )}
    </GlassCard>
  );
}
