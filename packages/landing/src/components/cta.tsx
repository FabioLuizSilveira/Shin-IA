import type { ReactNode } from "react";
import { GlassCard } from "@shina/design-system";

export interface CtaProps {
  title: ReactNode;
  description?: string;
  primaryCta: ReactNode;
  secondaryCta?: ReactNode;
}

/** Faixa de CTA final de página (doc 10). Um glow sutil atrás, nunca gradiente sólido de fundo. */
export function Cta({ title, description, primaryCta, secondaryCta }: CtaProps) {
  return (
    <div className="max-w-4xl mx-auto px-4">
      <GlassCard className="p-12 text-center relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[image:var(--shina-gradient)] opacity-10 pointer-events-none"
        />
        <div className="relative">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">{title}</h2>
          {description && (
            <p className="text-[var(--shina-text-secondary)] text-lg mb-10 max-w-xl mx-auto">
              {description}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {primaryCta}
            {secondaryCta}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
