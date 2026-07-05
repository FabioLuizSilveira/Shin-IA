"use client";

// Select nativo estilizado (doc 10 Dropdown/Select — versão leve para
// formulários simples; CommandPalette cobre a busca com > 8 opções).

import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, id, className, children, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <div>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-xs font-medium text-[var(--shina-text-secondary)] mb-1.5"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={fieldId}
        className={cn(
          "w-full px-3 py-2 rounded-md text-sm transition-colors duration-fast",
          "bg-[var(--shina-surface-glass)] border border-[var(--shina-border-default)]",
          "text-[var(--shina-text-primary)]",
          "hover:border-[var(--shina-border-strong)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--shina-border-focus)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
});
