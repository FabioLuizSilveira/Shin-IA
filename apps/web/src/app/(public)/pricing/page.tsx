// Wave 3: reconstruída sobre @shina/landing (Pricing, Faq, SectionTitle).

import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Pricing, Faq, SectionTitle, type PricingPlan } from "@shina/landing";
import { Zap } from "@shina/icons";

export const metadata: Metadata = {
  title: "Preços — Planos para cada tamanho de operação",
  description:
    "Planos Shinã: Starter, Professional e Enterprise. Começa grátis, escala sem limite. Veja qual plano combina com sua frota.",
};

const PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "Grátis",
    period: "para sempre",
    description: "Perfeito para frotas pequenas e equipes em crescimento.",
    features: [
      "Até 10 ativos cadastrados",
      "Até 3 usuários",
      "100 operações/mês",
      "Dashboard básico",
      "Suporte por email",
    ],
    cta: (
      <Link
        href="/contact"
        id="plan-cta-starter"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors no-underline bg-[var(--shina-surface-glass-hover)] text-white hover:bg-[var(--shina-border-strong)]"
      >
        Começar grátis
      </Link>
    ),
  },
  {
    id: "professional",
    name: "Professional",
    price: "R$ 499",
    period: "/ mês",
    description: "Para operações em escala com necessidade de automação e relatórios avançados.",
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
    cta: (
      <Link
        href="/contact"
        id="plan-cta-professional"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors no-underline bg-[var(--shina-primary)] text-white hover:bg-[var(--shina-primary-hover)]"
      >
        Iniciar trial de 14 dias
      </Link>
    ),
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Personalizado",
    period: "",
    description: "Para grandes operações com requisitos customizados de compliance e integração.",
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
    cta: (
      <Link
        href="/contact"
        id="plan-cta-enterprise"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors no-underline bg-[var(--shina-surface-glass-hover)] text-white hover:bg-[var(--shina-border-strong)]"
      >
        Falar com vendas
      </Link>
    ),
  },
];

const FAQ = [
  {
    question: "Preciso de cartão de crédito para o Starter?",
    answer: "Não! O plano Starter é gratuito para sempre, sem necessidade de cartão de crédito.",
  },
  {
    question: "Posso mudar de plano a qualquer momento?",
    answer: "Sim. O upgrade é instantâneo. O downgrade acontece no próximo ciclo de faturamento.",
  },
  {
    question: "Como funciona o trial do Professional?",
    answer: "14 dias com acesso completo a todos os recursos, sem cobrança. Cancele quando quiser.",
  },
  {
    question: "Os dados ficam seguros na nuvem?",
    answer:
      "Todos os dados são criptografados em trânsito e em repouso. Usamos Supabase com RLS e backups diários.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <section className="py-20 text-center">
          <div className="max-w-3xl mx-auto px-4">
            <SectionTitle
              eyebrow="Preços simples e transparentes"
              title={
                <>
                  Planos para cada
                  <span className="text-gradient"> tamanho de frota</span>
                </>
              }
              description="Comece grátis e escale conforme seu negócio cresce. Sem surpresas na fatura."
            />
          </div>
        </section>

        <section className="pb-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Pricing plans={PLANS} />
          </div>
        </section>

        <section className="pb-24 bg-[var(--shina-surface-deep)]/50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-2xl font-black text-white text-center mb-10 flex items-center justify-center gap-2">
              <Zap size={20} className="text-[var(--shina-accent)]" />
              Perguntas frequentes
            </h2>
            <Faq items={FAQ} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
