"use client";

// Planos — copy e valores preservados integralmente do original (Wave 3),
// reskin liquid glass.

import { motion } from "framer-motion";
import { ArrowRight } from "@shina/icons";

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
  ctaHref: string;
  ctaLabel: string;
}

const PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "R$149",
    period: "/ mês",
    description: "Para pequenos negócios e criadores.",
    features: [
      "14 dias de trial grátis",
      "3 marcas e 3 usuários",
      "100 gerações IA/mês",
      "20 clonagens/mês",
      "Ad Library ilimitada",
      "3 integrações de ads",
      "5 concorrentes monitorados",
      "Bring Your Own Key",
      "10.000 créditos IA",
    ],
    ctaHref: "/login",
    ctaLabel: "Iniciar teste grátis",
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$399",
    period: "/ mês",
    description: "Para equipes de marketing em escala.",
    highlight: true,
    badge: "Mais popular",
    features: [
      "15 marcas e 15 usuários",
      "Gerações e clonagens ilimitadas",
      "Todas as integrações de ads",
      "MCP Server (agentes IA)",
      "20 concorrentes monitorados",
      "Bring Your Own Key",
      "100.000 créditos IA",
    ],
    ctaHref: "/login",
    ctaLabel: "Assinar Pro",
  },
  {
    id: "business",
    name: "Business",
    price: "R$999",
    period: "/ mês",
    description: "Para agências e operações multi-cliente.",
    features: [
      "Marcas e usuários ilimitados",
      "Tudo do Pro",
      "API pública",
      "White-label",
      "Concorrentes ilimitados",
      "500.000 créditos IA",
      "Suporte prioritário",
    ],
    ctaHref: "mailto:contato@shinaia.com.br",
    ctaLabel: "Falar com vendas",
  },
];

export function PricingSection() {
  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
      {PLANS.map((plan, idx) => (
        <motion.div
          key={plan.id}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: idx * 0.1 }}
          className={`relative rounded-3xl p-8 flex flex-col ${plan.highlight ? "liquid-glass-strong" : "liquid-glass"}`}
        >
          {plan.badge && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-black text-xs font-body font-semibold rounded-full">
              {plan.badge}
            </span>
          )}
          <h3 className="font-body font-semibold text-white mb-1">{plan.name}</h3>
          <p className="font-body text-sm text-white/70 mb-4">{plan.description}</p>
          <p className="font-heading italic text-3xl text-white mb-1">
            {plan.price}
            <span className="font-body not-italic text-sm text-white/60 ml-1">{plan.period}</span>
          </p>
          <ul className="font-body text-sm text-white/80 space-y-2 my-6 flex-1">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="text-white/40 mt-1">—</span>
                {feature}
              </li>
            ))}
          </ul>
          <a
            href={plan.ctaHref}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-body font-semibold transition-colors no-underline ${
              plan.highlight
                ? "bg-white text-black hover:bg-white/90"
                : "liquid-glass text-white hover:bg-white/5"
            }`}
          >
            {plan.ctaLabel}
            <ArrowRight size={16} />
          </a>
        </motion.div>
      ))}
    </div>
  );
}
