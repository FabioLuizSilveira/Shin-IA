// Wave 3: reconstruída sobre @shina/landing (Pricing, SectionTitle).

import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Pricing, SectionTitle, type PricingPlan } from "@shina/landing";
import { ArrowRight } from "@shina/icons";

export const metadata: Metadata = {
  title: "Preços",
  description:
    "Planos do Shinã Marketing IA: Free, Starter, Pro e Business. Comece grátis e escale com IA.",
};

const PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "R$0",
    period: "para sempre",
    description: "Para conhecer a plataforma.",
    features: [
      "1 marca",
      "5 gerações IA/mês",
      "Ad Library (5 buscas/dia)",
      "Swipe file (50 itens)",
      "1 concorrente monitorado",
      "500 créditos IA",
    ],
    cta: (
      <a
        href="/login"
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors no-underline border border-[var(--shina-border-default)] hover:border-[var(--shina-border-strong)] text-white hover:bg-[var(--shina-surface-glass-hover)]"
      >
        Começar grátis
        <ArrowRight size={16} />
      </a>
    ),
  },
  {
    id: "starter",
    name: "Starter",
    price: "R$149",
    period: "/ mês",
    description: "Para pequenos negócios e criadores.",
    features: [
      "3 marcas e 3 usuários",
      "100 gerações IA/mês",
      "20 clonagens/mês",
      "Ad Library ilimitada",
      "1 integração de ads",
      "5 concorrentes monitorados",
      "Bring Your Own Key",
      "10.000 créditos IA",
    ],
    cta: (
      <a
        href="/login"
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors no-underline border border-[var(--shina-border-default)] hover:border-[var(--shina-border-strong)] text-white hover:bg-[var(--shina-surface-glass-hover)]"
      >
        Assinar Starter
        <ArrowRight size={16} />
      </a>
    ),
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
    cta: (
      <a
        href="/login"
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors no-underline bg-[var(--shina-primary)] hover:bg-indigo-500 text-white"
      >
        Assinar Pro
        <ArrowRight size={16} />
      </a>
    ),
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
    cta: (
      <a
        href="mailto:contato@shinaia.com.br"
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors no-underline border border-[var(--shina-border-default)] hover:border-[var(--shina-border-strong)] text-white hover:bg-[var(--shina-surface-glass-hover)]"
      >
        Falar com vendas
        <ArrowRight size={16} />
      </a>
    ),
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-4">
          <SectionTitle
            title={
              <>
                Planos para cada <span className="text-gradient-mkt">fase da sua operação</span>
              </>
            }
            description="Comece grátis, sem cartão de crédito. Faça upgrade quando precisar de mais volume, integrações ou agentes."
          />

          <Pricing plans={PLANS} />

          <p className="text-center text-xs text-[var(--shina-text-tertiary)] mt-10">
            Precisa de Enterprise? SSO, SLA 99,99%, workspaces ilimitados e suporte dedicado —{" "}
            <a
              href="mailto:contato@shinaia.com.br"
              className="text-[var(--shina-text-secondary)] hover:text-white"
            >
              fale com a gente
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
