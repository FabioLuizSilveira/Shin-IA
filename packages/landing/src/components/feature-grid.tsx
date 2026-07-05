import type { ReactNode } from "react";
import { cn } from "@shina/design-system";
import { FeatureCard, type FeatureCardProps } from "./feature-card";

export interface FeatureGridProps {
  features: FeatureCardProps[];
  columns?: 2 | 3;
  className?: string;
  children?: ReactNode;
}

export function FeatureGrid({ features, columns = 3, className, children }: FeatureGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5",
        columns === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2",
        className,
      )}
    >
      {features.map((f) => (
        <FeatureCard key={f.title} {...f} />
      ))}
      {children}
    </div>
  );
}
