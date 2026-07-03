import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Check, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Preços",
  description:
    "Planos do Shinã Marketing AI: Free, Starter, Pro e Business. Comece grátis e escale com IA.",
};

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "R$0",
    period: "para sempre",
    description: "Para conhecer a plataforma.",
    cta: "Começar grátis",
    highlight: false,
    features: [
      "1 marca",
      "5 gerações IA/mês",
      "Ad Library (5 buscas/dia)",
      "Swipe file (50 itens)",
      "1 concorrente monitorado",
      "500 créditos IA",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "R$149",
    period: "/ mês",
    description: "Para pequenos negócios e criadores.",
    cta: "Assinar Starter",
    highlight: false,
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
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$399",
    period: "/ mês",
    description: "Para equipes de marketing em escala.",
    cta: "Assinar Pro",
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
  },
  {
    id: "business",
    name: "Business",
    price: "R$999",
    period: "/ mês",
    description: "Para agências e operações multi-cliente.",
    cta: "Falar com vendas",
    highlight: false,
    features: [
      "Marcas e usuários ilimitados",
      "Tudo do Pro",
      "API pública",
      "White-label",
      "Concorrentes ilimitados",
      "500.000 créditos IA",
      "Suporte prioritário",
    ],
  },
];

export default function PricingPage() {
  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mkt-primary to-mkt-secondary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Shinã <span className="text-gradient-mkt">Marketing AI</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-mkt-primary hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors no-underline"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="pt-32 pb-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Planos para cada <span className="text-gradient-mkt">fase da sua operação</span>
            </h1>
            <p className="text-lg text-slate-400">
              Comece grátis, sem cartão de crédito. Faça upgrade quando precisar de mais volume,
              integrações ou agentes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={[
                  "card-glass rounded-2xl p-6 flex flex-col relative",
                  plan.highlight ? "border-mkt-primary/50 ring-1 ring-mkt-primary/30" : "",
                ].join(" ")}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-mkt-primary text-white text-xs font-bold rounded-full">
                    {plan.badge}
                  </span>
                )}
                <h2 className="text-lg font-bold text-white mb-1">{plan.name}</h2>
                <p className="text-xs text-slate-400 mb-4">{plan.description}</p>
                <div className="mb-5">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-sm text-slate-500 ml-1">{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-mkt-glow shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={[
                    "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors no-underline",
                    plan.highlight
                      ? "bg-mkt-primary hover:bg-indigo-500 text-white"
                      : "border border-white/10 hover:border-white/20 text-white hover:bg-white/5",
                  ].join(" ")}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-500 mt-10">
            Precisa de Enterprise? SSO, SLA 99,99%, workspaces ilimitados e suporte dedicado —{" "}
            <a href="mailto:contato@shinaia.com.br" className="text-slate-400 hover:text-white">
              fale com a gente
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-white/5 py-10 text-center text-sm text-slate-500">
        Shinã Marketing AI © {new Date().getFullYear()} — parte do ecossistema{" "}
        <a href="https://shinaia.com.br" className="text-slate-400 hover:text-white no-underline">
          Shinã I.A.
        </a>
      </footer>
    </>
  );
}
