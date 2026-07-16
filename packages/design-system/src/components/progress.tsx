export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

/** Barra de progresso determinada (doc 10 Progress). Para indeterminado, ver FlowLoader do @shina/flow-engine. */
export function Progress({ value, max = 100, label, className }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={className}>
      {label && <p className="text-xs text-[var(--shina-text-secondary)] mb-1.5">{label}</p>}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-1.5 rounded-full bg-[var(--shina-surface-glass)] overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-[var(--shina-primary)] transition-[width] duration-base"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
