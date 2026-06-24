"use client";

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export function DonutChart({
  data,
  size = 120,
  thickness = 20,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const slices = data.map((d) => {
    const pct = d.value / total;
    const dashArray = `${pct * circ} ${circ}`;
    const dashOffset = -offset * circ;
    offset += pct;
    return { ...d, dashArray, dashOffset };
  });

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* background track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {slices.map((s, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={s.dashArray}
              strokeDashoffset={s.dashOffset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        {(centerLabel !== undefined || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-xl font-bold text-slate-900">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-slate-500 text-center leading-tight px-2">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-xs text-slate-600">{d.label}</span>
            <span className="text-xs font-semibold text-slate-900 ml-auto pl-3">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
