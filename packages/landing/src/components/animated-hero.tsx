// AnimatedHero (doc 10 Grupo landing). Hero com ilustração Flow/Neural
// acompanhando o título — reforça "operações inteligentes em movimento".

import type { ReactNode } from "react";
import { FlowIllustration, NeuralIllustration } from "@shina/illustrations";
import { Hero, type HeroProps } from "./hero";

export interface AnimatedHeroProps extends HeroProps {
  illustration?: "flow" | "neural";
}

export function AnimatedHero({
  illustration = "flow",
  product = "platform",
  ...heroProps
}: AnimatedHeroProps) {
  const Illustration = illustration === "neural" ? NeuralIllustration : FlowIllustration;

  return (
    <Hero
      {...heroProps}
      product={product}
      eyebrow={
        (heroProps.eyebrow as ReactNode) ?? (
          <span className="flex items-center gap-2">
            <Illustration size={20} product={product} />
          </span>
        )
      }
    />
  );
}
