import type { ReactNode } from "react";
import { cn } from "@shina/design-system";

export interface SectionTitleProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  align?: "center" | "left";
  className?: string;
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn("max-w-2xl mb-14", align === "center" ? "mx-auto text-center" : "", className)}
    >
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--shina-accent)] mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">{title}</h2>
      {description && <p className="text-lg text-[var(--shina-text-secondary)]">{description}</p>}
    </div>
  );
}
