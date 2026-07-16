// HeroDashboard (doc 10 Grupo landing). Hero com preview de produto abaixo —
// um GlassCard "flutuando" que sugere o dashboard real sem ser um screenshot.

import type { ReactNode } from "react";
import { GlassCard } from "@shina/design-system";
import { Hero, type HeroProps } from "./hero";

export interface HeroDashboardProps extends HeroProps {
  preview: ReactNode;
}

export function HeroDashboard({ preview, ...heroProps }: HeroDashboardProps) {
  return (
    <>
      <Hero {...heroProps} />
      <div className="relative max-w-5xl mx-auto px-4 -mt-6 mb-20">
        <GlassCard elevation={2} className="p-2 sm:p-4 shadow-lg">
          {preview}
        </GlassCard>
      </div>
    </>
  );
}
