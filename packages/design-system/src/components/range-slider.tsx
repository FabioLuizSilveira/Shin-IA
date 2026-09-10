"use client";

// RangeSlider (discovery wizard). Entrada numérica por faixa —
// "quantos ativos você gerencia?", "quantas pessoas vão usar?". Mostra o
// valor atual e um sufixo opcional. Controlado pelo consumidor.

import { useId, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  valueLabel?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function RangeSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  valueLabel,
  disabled = false,
  className,
}: RangeSliderProps) {
  const id = useId();
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className={className}>
      {(label || valueLabel !== undefined) && (
        <div className="mb-2 flex items-baseline justify-between">
          {label && (
            <label htmlFor={id} className="text-xs font-medium text-[var(--shina-text-secondary)]">
              {label}
            </label>
          )}
          <span className="text-sm font-semibold text-[var(--shina-text-primary)]">
            {valueLabel ?? value}
          </span>
        </div>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={valueLabel ? String(valueLabel) : undefined}
        className={cn(
          "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--shina-surface-glass)]",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--shina-primary)]",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0",
          "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--shina-primary)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--shina-border-focus)]",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        style={{
          background: `linear-gradient(to right, var(--shina-primary) ${pct}%, var(--shina-surface-glass) ${pct}%)`,
        }}
      />
    </div>
  );
}
