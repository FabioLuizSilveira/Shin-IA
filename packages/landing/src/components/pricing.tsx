// Pricing (doc 10 Grupo landing). Plano destacado com ring accent — nunca
// dois planos "highlight" ao mesmo tempo.

import type { ReactNode } from "react";
import { Check } from "@shina/icons";
import { GlassCard, Badge, cn } from "@shina/design-system";

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: ReactNode;
  highlight?: boolean;
  badge?: string;
}

export interface PricingProps {
  plans: PricingPlan[];
}

export function Pricing({ plans }: PricingProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5",
        plans.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3",
      )}
    >
      {plans.map((plan) => (
        <GlassCard
          key={plan.id}
          ring={plan.highlight ? "accent" : "none"}
          className="p-6 flex flex-col relative"
        >
          {plan.badge && (
            <Badge variant="info" className="absolute -top-3 left-1/2 -translate-x-1/2">
              {plan.badge}
            </Badge>
          )}
          <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
          <p className="text-xs text-[var(--shina-text-tertiary)] mb-4">{plan.description}</p>
          <div className="mb-5">
            <span className="text-3xl font-black text-white">{plan.price}</span>
            <span className="text-sm text-[var(--shina-text-tertiary)] ml-1">{plan.period}</span>
          </div>
          <ul className="space-y-2.5 mb-6 flex-1">
            {plan.features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 text-sm text-[var(--shina-text-secondary)]"
              >
                <Check size={16} className="text-[var(--shina-accent)] shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          {plan.cta}
        </GlassCard>
      ))}
    </div>
  );
}
