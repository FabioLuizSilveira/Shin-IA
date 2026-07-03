import type { LucideIcon } from "lucide-react";

interface ModulePlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  milestone: string;
}

export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  milestone,
}: ModulePlaceholderProps) {
  return (
    <div className="card-glass rounded-2xl p-12 text-center max-w-lg mx-auto mt-12">
      <div className="w-12 h-12 rounded-2xl bg-mkt-primary/10 flex items-center justify-center mx-auto mb-5">
        <Icon className="w-6 h-6 text-mkt-glow" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-sm text-slate-400 mb-5">{description}</p>
      <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-slate-400">
        Em desenvolvimento — {milestone}
      </span>
    </div>
  );
}
