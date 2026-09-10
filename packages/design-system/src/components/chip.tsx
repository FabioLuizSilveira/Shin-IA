"use client";

// Chip (discovery wizard, filtros). Pílula INTERATIVA de seleção — diferente
// do Badge, que é apenas semântico e não clicável. Usado para multi-seleção
// leve ("marque todas as atividades que se aplicam").

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface ChipProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Chip({ label, selected = false, onToggle, icon, disabled, className }: ChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-fast",
        selected
          ? "border-[var(--shina-primary)] bg-[var(--shina-primary)]/15 text-[var(--shina-accent)]"
          : "border-[var(--shina-border-default)] text-[var(--shina-text-secondary)] hover:border-[var(--shina-border-strong)]",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {label}
    </button>
  );
}
