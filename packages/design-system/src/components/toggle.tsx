"use client";

// Toggle (switch booleano). Usado no discovery wizard para perguntas
// sim/não ("Você precisa acompanhar a localização em tempo real?"). O estado
// é controlado pelo consumidor.

import { useId } from "react";
import { cn } from "../utils/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}: ToggleProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-fast",
          checked
            ? "bg-[var(--shina-primary)] border-[var(--shina-primary)]"
            : "bg-[var(--shina-surface-glass)] border-[var(--shina-border-strong)]",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white transition-transform duration-fast",
            checked ? "translate-x-[18px]" : "translate-x-[3px]",
          )}
        />
      </button>
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer select-none">
          {label && (
            <span className="block text-sm font-medium text-[var(--shina-text-primary)]">
              {label}
            </span>
          )}
          {description && (
            <span className="block text-xs text-[var(--shina-text-secondary)]">{description}</span>
          )}
        </label>
      )}
    </div>
  );
}
