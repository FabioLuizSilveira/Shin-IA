// EmptyState (doc 10/03 P9). Sempre: o que é, por que importa, primeiro passo.

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface EmptyStateProps {
  illustration?: ReactNode;
  title: string;
  description: string;
  /** Sugestão contextual da IA para o próximo passo — nunca genérica. */
  aiHint?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  illustration,
  title,
  description,
  aiHint,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center py-12 px-6", className)}>
      {illustration && <div className="mb-4">{illustration}</div>}
      <h3 className="text-base font-bold text-[var(--shina-text-title)] mb-1.5">{title}</h3>
      <p className="text-sm text-[var(--shina-text-secondary)] max-w-sm mb-5">{description}</p>
      {aiHint && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--shina-primary)]/10 border border-[var(--shina-primary)]/20 text-[var(--shina-accent)] text-xs font-medium mb-5 max-w-sm">
          {aiHint}
        </div>
      )}
      {action}
    </div>
  );
}
