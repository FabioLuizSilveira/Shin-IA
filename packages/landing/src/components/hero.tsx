// Hero (doc 10 Grupo landing). Eyebrow → Display → subtítulo → 2 CTAs.
// Fundo por FlowBackground (doc 16 Hero); no máx. 1 palavra com gradiente.

import type { ReactNode } from "react";
import { FlowBackground } from "@shina/flow-engine";
import type { ThemeProduct } from "@shina/tokens";
import { cn } from "@shina/design-system";

export interface HeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle: string;
  primaryCta: ReactNode;
  secondaryCta?: ReactNode;
  product?: ThemeProduct;
  className?: string;
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  product = "platform",
  className,
}: HeroProps) {
  return (
    <FlowBackground variant="hero" product={product} className={cn("pt-32 pb-20", className)}>
      <div className="relative max-w-5xl mx-auto px-4 text-center">
        {eyebrow && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--shina-primary)]/10 border border-[var(--shina-primary)]/20 text-[var(--shina-accent)] text-sm font-medium mb-8">
            {eyebrow}
          </div>
        )}
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
          {title}
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-[var(--shina-text-secondary)] mb-10">
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {primaryCta}
          {secondaryCta}
        </div>
      </div>
    </FlowBackground>
  );
}
