"use client";

// Stepper (onboarding / discovery wizard). Mostra o progresso por etapas
// nomeadas — passo atual, concluídos e futuros. Não navega sozinho: o
// consumidor controla `current` e decide se um passo concluído é clicável
// via `onStepClick`.

import { Check } from "@shina/icons";
import { cn } from "../utils/cn";

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  current: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label="Progresso">
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";
        const clickable = Boolean(onStepClick) && index < current;
        return (
          <li key={step.id} className="flex items-center gap-2 flex-1 last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStepClick?.(index) : undefined}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors duration-fast",
                clickable && "hover:text-[var(--shina-accent)] cursor-pointer",
                !clickable && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold border",
                  state === "done" &&
                    "bg-[var(--shina-primary)] border-[var(--shina-primary)] text-white",
                  state === "current" && "border-[var(--shina-primary)] text-[var(--shina-accent)]",
                  state === "upcoming" &&
                    "border-[var(--shina-border-default)] text-[var(--shina-text-tertiary)]",
                )}
              >
                {state === "done" ? <Check size={13} /> : index + 1}
              </span>
              <span
                className={cn(
                  state === "upcoming"
                    ? "text-[var(--shina-text-tertiary)]"
                    : "text-[var(--shina-text-primary)]",
                )}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 min-w-4",
                  index < current ? "bg-[var(--shina-primary)]" : "bg-[var(--shina-border-subtle)]",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
