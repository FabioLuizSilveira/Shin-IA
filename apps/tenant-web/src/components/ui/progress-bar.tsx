interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  showPercent?: boolean;
}

export function ProgressBar({
  label,
  value,
  max,
  color = "#2563EB",
  showPercent = true,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-semibold text-slate-900">
          {showPercent ? `${pct}%` : value}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
