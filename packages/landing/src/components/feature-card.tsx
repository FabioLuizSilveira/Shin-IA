import type { ReactNode } from "react";
import { GlassCard } from "@shina/design-system";

export interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <GlassCard className="p-6">
      <div className="w-10 h-10 rounded-xl bg-[var(--shina-primary)]/10 flex items-center justify-center mb-4 text-[var(--shina-accent)]">
        {icon}
      </div>
      <h3 className="text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-[var(--shina-text-secondary)] leading-relaxed">{description}</p>
    </GlassCard>
  );
}
