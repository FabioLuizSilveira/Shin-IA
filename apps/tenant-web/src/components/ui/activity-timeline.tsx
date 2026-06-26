interface TimelineItem {
  time: string;
  title: string;
  description: string;
  type: "info" | "success" | "warning" | "error";
}

interface ActivityTimelineProps {
  items: TimelineItem[];
}

const typeConfig = {
  info: { border: "border-shina-blue", dot: "bg-shina-blue", badge: "bg-blue-50 text-blue-700" },
  success: {
    border: "border-shina-green",
    dot: "bg-shina-green",
    badge: "bg-emerald-50 text-emerald-700",
  },
  warning: { border: "border-amber-400", dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700" },
  error: { border: "border-red-500", dot: "bg-red-500", badge: "bg-red-50 text-red-700" },
};

export function ActivityTimeline({ items }: ActivityTimelineProps) {
  return (
    <div className="space-y-0">
      {items.map((item, idx) => {
        const config = typeConfig[item.type];
        return (
          <div key={idx} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${config.dot}`} />
              {idx < items.length - 1 && (
                <div className={`w-0.5 flex-1 mt-2 border-l-2 ${config.border} opacity-20`} />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <span className="text-xs text-slate-400">{item.time}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
