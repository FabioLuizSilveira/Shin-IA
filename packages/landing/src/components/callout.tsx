import type { ReactNode } from "react";
import { Info } from "@shina/icons";
import { cn } from "@shina/design-system";

export interface CalloutProps {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Callout({ icon, children, className }: CalloutProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl bg-[var(--shina-primary)]/10 border border-[var(--shina-primary)]/20 text-sm text-[var(--shina-accent)]",
        className,
      )}
    >
      {icon ?? <Info size={16} className="shrink-0 mt-0.5" />}
      <div>{children}</div>
    </div>
  );
}
