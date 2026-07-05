// EmptyState (doc 10/03 P9). Sempre: o que é, por que importa, primeiro passo.

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface EmptyStateProps {
  illustration?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center py-12 px-6", className)}>
      {illustration && <div className="mb-4">{illustration}</div>}
      <h3 className="text-base font-bold text-[var(--shina-text-title)] mb-1.5">{title}</h3>
      <p className="text-sm text-[var(--shina-text-secondary)] max-w-sm mb-5">{description}</p>
      {action}
    </div>
  );
}
