import type { ReactNode } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  // Platform-wide convention: any card summarizing a section should link to
  // it — pass href to make the card clickable, omit for a purely
  // informational card.
  href?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend = "neutral",
  href,
}: MetricCardProps) {
  const trendColors = {
    up: "text-emerald-600",
    down: "text-red-500",
    neutral: "text-slate-500 dark:text-slate-400",
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const className = `block bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/50 p-6 shadow-sm hover:shadow-md transition-shadow duration-200 ${href ? "cursor-pointer hover:border-shina-blue/40" : ""}`;

  const content = (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {title}
        </p>
        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50 font-display">
          {value}
        </p>
        {(change !== undefined || changeLabel) && (
          <div className={`mt-2 flex items-center gap-1 text-sm font-medium ${trendColors[trend]}`}>
            <TrendIcon className="w-4 h-4" />
            {change !== undefined && (
              <span>
                {change > 0 ? "+" : ""}
                {change}%
              </span>
            )}
            {changeLabel && (
              <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </div>
      {icon && (
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-shina-blue/10 flex items-center justify-center text-shina-blue">
          {icon}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
