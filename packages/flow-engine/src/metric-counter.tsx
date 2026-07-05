"use client";

// Metric Counter (doc 11): interpola do valor anterior ao novo em `slow`,
// tabular-nums, direto ao valor em reduced-motion.

import { useEffect, useRef, useState } from "react";
import { durations } from "@shina/tokens";
import { useReducedMotion } from "./internal";

export interface MetricCounterProps {
  value: number;
  format?: (value: number) => string;
  durationMs?: number;
  className?: string;
}

export function MetricCounter({
  value,
  format = (v) => Math.round(v).toLocaleString("pt-BR"),
  durationMs = durations.slow,
  className,
}: MetricCounterProps) {
  const reduced = useReducedMotion();
  const previous = useRef(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;

    if (reduced || durationMs <= 0 || from === value) {
      setDisplay(value);
      return;
    }

    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // ease.out aproximado (doc 11): rápido no início, assenta no fim
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, reduced]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(display)}
    </span>
  );
}
