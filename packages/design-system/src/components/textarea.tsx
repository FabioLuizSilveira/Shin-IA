"use client";

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className, rows = 4, ...props },
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
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          "w-full px-3 py-2 rounded-md text-sm transition-colors duration-fast resize-none",
          "bg-[var(--shina-surface-glass)] border border-[var(--shina-border-default)]",
          "text-[var(--shina-text-primary)] placeholder:text-[var(--shina-text-tertiary)]",
          "hover:border-[var(--shina-border-strong)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--shina-border-focus)]",
          error && "border-red-500/50",
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[var(--shina-text-tertiary)]">{hint}</p>
      ) : null}
    </div>
  );
});
