"use client";

// RadioCard / SelectableCard (discovery wizard). Cartão grande e clicável
// para escolha única (role="radio") ou múltipla (role="checkbox"), com
// título, descrição e ícone opcionais. O estado é controlado pelo consumidor.

import type { ReactNode } from "react";
import { Check } from "@shina/icons";
import { cn } from "../utils/cn";

export interface RadioCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export function RadioCard({
  title,
  description,
  icon,
  selected,
  onSelect,
  multiple = false,
  disabled = false,
  className,
}: RadioCardProps) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all duration-fast",
        "bg-[var(--shina-surface-glass)]",
        selected
          ? "border-[var(--shina-primary)] ring-2 ring-[var(--shina-primary)]/30"
          : "border-[var(--shina-border-default)] hover:border-[var(--shina-border-strong)]",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {icon && (
        <span className="mt-0.5 shrink-0 text-[var(--shina-accent)]" aria-hidden>
          {icon}
        </span>
      )}
      <span className="flex-1">
        <span className="block text-sm font-semibold text-[var(--shina-text-primary)]">
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs text-[var(--shina-text-secondary)]">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition-colors",
          multiple ? "rounded-md" : "rounded-full",
          selected
            ? "bg-[var(--shina-primary)] border-[var(--shina-primary)] text-white"
            : "border-[var(--shina-border-strong)]",
        )}
      >
        {selected && <Check size={12} />}
      </span>
    </button>
  );
}
