"use client";

// Input (doc 10 Grupo B). Label acima, hint/erro abaixo, foco visível.

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
}

const fieldClasses = cn(
  "w-full px-3 py-2 rounded-md text-sm transition-colors duration-fast",
  "bg-[var(--shina-surface-glass)] border border-[var(--shina-border-default)]",
  "text-[var(--shina-text-primary)] placeholder:text-[var(--shina-text-tertiary)]",
  "hover:border-[var(--shina-border-strong)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--shina-border-focus)]",
  "disabled:opacity-60 disabled:cursor-not-allowed",
);

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

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
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--shina-text-tertiary)]">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cn(fieldClasses, icon && "pl-9", error && "border-red-500/50", className)}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-[var(--shina-text-tertiary)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
