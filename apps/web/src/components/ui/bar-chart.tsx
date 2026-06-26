"use client";

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  title?: string;
  height?: number;
  showValues?: boolean;
}

export function BarChart({ data, title, height = 160, showValues = true }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      {title && (
        <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">{title}</p>
      )}
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((item) => (
          <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
            {showValues && (
              <span className="text-xs font-semibold text-slate-700">{item.value}</span>
            )}
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{
                height: `${(item.value / max) * (height - 32)}px`,
                backgroundColor: item.color ?? "#2563EB",
                minHeight: item.value > 0 ? 4 : 0,
              }}
            />
            <span className="text-[10px] text-slate-500 text-center leading-tight">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
