import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Check, Zap, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Preços — Planos para cada tamanho de operação",
  description:
    "Planos Shinã: Starter, Professional e Enterprise. Começa grátis, escala sem limite. Veja qual plano combina com sua frota.",
};

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Grátis",
    period: "para sempre",
    description: "Perfeito para frotas pequenas e equipes em crescimento.",
    cta: "Começar grátis",
    ctaHref: "/contact",
    highlight: false,
    features: [
      "Até 10 ativos cadastrados",
      "Até 3 usuários",
      "100 operações/mês",
      "Dashboard básico",
      "Suporte por email",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    price: "R$ 499",
    period: "/ mês",
    description: "Para operações em escala com necessidade de automação e relatórios avançados.",
    cta: "Iniciar trial de 14 dias",
    ctaHref: "/contact",
    highlight: true,
    badge: "Mais popular",
    features: [
      "Até 500 ativos cadastrados",
      "Até 50 usuários",
      "Operações ilimitadas",
      "AI Center (insights automáticos)",
      "Analytics avançado",
      "CRM completo",
      "Gestão de contratos",
      "Comissões automáticas",
      "Suporte prioritário",
      "SLA 99.9%",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Personalizado",
    period: "",
    description: "Para grandes operações com requisitos customizados de compliance e integração.",
    cta: "Falar com vendas",
    ctaHref: "/contact",
    highlight: false,
    features: [
      "Ativos ilimitados",
      "Usuários ilimitados",
      "Multi-tenant & multi-branch",
      "AI avançado com fine-tuning",
      "Integrações via API/Webhook",
      "SSO / SAML",
      "Compliance LGPD + auditoria",
      "Gerente de conta dedicado",
      "SLA customizado",
      "Onboarding guiado",
    ],
  },
];

const FAQ = [
  {
    q: "Preciso de cartão de crédito para o Starter?",
    a: "Não! O plano Starter é gratuito para sempre, sem necessidade de cartão de crédito.",
  },
  {
    q: "Posso mudar de plano a qualquer momento?",
    a: "Sim. O upgrade é instantâneo. O downgrade acontece no próximo ciclo de faturamento.",
  },
  {
    q: "Como funciona o trial do Professional?",
    a: "14 dias com acesso completo a todos os recursos, sem cobrança. Cancele quando quiser.",
  },
  {
    q: "Os dados ficam seguros na nuvem?",
    a: "Todos os dados são criptografados em trânsito e em repouso. Usamos Supabase com RLS e backups diários.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        {/* Header */}
        <section className="py-20 text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              Preços simples e transparentes
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Planos para cada
              <span className="text-gradient"> tamanho de frota</span>
            </h1>
            <p className="text-lg text-slate-400">
              Comece grátis e escale conforme seu negócio cresce. Sem surpresas na fatura.
            </p>
          </div>
        </section>

        {/* Plans grid */}
        <section className="pb-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  id={`plan-card-${plan.id}`}
                  className={`relative rounded-2xl p-8 flex flex-col ${
                    plan.highlight
                      ? "bg-blue-600 border border-blue-400 shadow-2xl shadow-blue-500/30"
                      : "card-glass"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-blue-600 text-xs font-black rounded-full uppercase tracking-wide">
                      {plan.badge}
                    </div>
                  )}

                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-white mb-1">{plan.name}</h2>
                    <p
                      className={`text-sm mb-4 ${plan.highlight ? "text-blue-100" : "text-slate-400"}`}
                    >
                      {plan.description}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-white">{plan.price}</span>
                      {plan.period && (
                        <span
                          className={`text-sm ${plan.highlight ? "text-blue-200" : "text-slate-400"}`}
                        >
                          {plan.period}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check
                          className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlight ? "text-blue-200" : "text-green-400"}`}
                        />
                        <span
                          className={`text-sm ${plan.highlight ? "text-blue-50" : "text-slate-300"}`}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.ctaHref}
                    id={`plan-cta-${plan.id}`}
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition no-underline ${
                      plan.highlight
                        ? "bg-white text-blue-600 hover:bg-blue-50"
                        : "bg-white/10 text-white hover:bg-white/15 border border-white/10"
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-24 bg-slate-900/50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl font-black text-white text-center mb-10">
              Perguntas frequentes
            </h2>
            <div className="space-y-4">
              {FAQ.map((item) => (
                <div key={item.q} className="card-glass rounded-xl p-6">
                  <h3 className="text-sm font-bold text-white mb-2">{item.q}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
