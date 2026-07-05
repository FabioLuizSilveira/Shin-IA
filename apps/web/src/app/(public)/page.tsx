// Wave 3: landing reconstruída exclusivamente sobre @shina/landing +
// @shina/design-system + @shina/flow-engine. Nenhuma seção implementa
// markup de layout próprio — apenas composição dos componentes oficiais.
// Copy e dados preservados integralmente do original.

import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { appUrl } from "@/lib/domain";
import { Hero, SectionTitle, FeatureGrid, Cta } from "@shina/landing";
import { GlassCard } from "@shina/design-system";
import {
  Zap,
  Truck,
  Users,
  BarChart3,
  Brain,
  Shield,
  Clock,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Globe,
  FileText,
} from "@shina/icons";

export const metadata: Metadata = {
  title: "Shinã — Plataforma de Inteligência Operacional para Frotas",
  description:
    "Gerencie frota, operações e equipes com inteligência artificial. Dashboards em tempo real, automação e insights poderosos para empresas de mobilidade e logística.",
};

const FEATURES = [
  {
    icon: <Zap size={22} />,
    title: "Operações em tempo real",
    description:
      "Gerencie agendamentos, despachos e status de cada operação em uma única tela, com atualizações ao vivo.",
  },
  {
    icon: <Truck size={22} />,
    title: "Gestão de Frota & Ativos",
    description:
      "Controle veículos, equipamentos e tecnologia. Métricas de utilização, manutenção e disponibilidade instantâneas.",
  },
  {
    icon: <Brain size={22} />,
    title: "AI Center",
    description:
      "Insights gerados por IA: resumos executivos, detecção de anomalias, previsão de demanda e sugestões de otimização.",
  },
  {
    icon: <Users size={22} />,
    title: "CRM & Equipes",
    description:
      "Gerencie clientes, parceiros, fornecedores e toda a sua equipe. Convide membros, defina papéis e acompanhe o desempenho.",
  },
  {
    icon: <FileText size={22} />,
    title: "Contratos & Financeiro",
    description:
      "Controle contratos, faturas, comissões e fluxo de caixa. Relatórios financeiros automáticos e alertas de vencimento.",
  },
  {
    icon: <BarChart3 size={22} />,
    title: "Analytics Avançado",
    description:
      "Dashboards interativos com KPIs customizáveis. Visualize tendências, compare períodos e tome decisões orientadas a dados.",
  },
];

const BENEFITS = [
  "Redução de 35% no tempo de despacho",
  "Visibilidade total da frota em tempo real",
  "IA que aprende com seus dados operacionais",
  "Multi-tenant: uma plataforma para toda a empresa",
  "Onboarding em menos de 5 minutos",
  "99.9% de uptime garantido em SLA",
];

const STATS = [
  { label: "Redução de custos operacionais", value: "28%" },
  { label: "Aumento de produtividade da frota", value: "40%" },
  { label: "Tempo de onboarding", value: "<5min" },
  { label: "Uptime garantido por SLA", value: "99.9%" },
];

const LOGOS = [
  "Transportes Brasil",
  "LogiTech S.A.",
  "Mobilidade Verde",
  "Frota Express",
  "AgriFleet",
  "HealthMove",
];

const TRUST_ITEMS = [
  {
    icon: <Shield size={22} />,
    title: "Segurança enterprise",
    description:
      "Criptografia end-to-end, RLS por tenant, backups automáticos e conformidade LGPD.",
  },
  {
    icon: <Globe size={22} />,
    title: "Multi-região",
    description:
      "Infraestrutura distribuída globalmente via Supabase, com edge functions para baixa latência.",
  },
  {
    icon: <Clock size={22} />,
    title: "Suporte 24/7",
    description:
      "Time dedicado de suporte técnico e sucesso do cliente para garantir sua operação.",
  },
];

export default function HomePage() {
  const loginUrl = appUrl("/login");

  return (
    <>
      <Navbar />
      <main>
        <Hero
          eyebrow={
            <>
              <Sparkles size={14} /> Plataforma de nova geração para gestão operacional
            </>
          }
          title={
            <>
              Inteligência operacional
              <br />
              <span className="text-gradient">para a sua frota</span>
            </>
          }
          subtitle="Shinã é a plataforma SaaS com IA que unifica gestão de frota, operações, CRM, financeiro e análise em um único lugar. Do agendamento ao insight, tudo conectado."
          primaryCta={
            <a
              href={loginUrl}
              id="hero-cta-primary"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--shina-primary)] hover:bg-[var(--shina-primary-hover)] text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-[var(--shina-primary)]/30 no-underline"
            >
              Acessar plataforma
              <ArrowRight size={20} />
            </a>
          }
          secondaryCta={
            <Link
              href="/#features"
              id="hero-cta-secondary"
              className="inline-flex items-center gap-2 px-8 py-4 border border-[var(--shina-border-default)] hover:border-[var(--shina-border-strong)] text-white font-semibold text-lg rounded-2xl transition-all hover:bg-[var(--shina-surface-glass-hover)] no-underline"
            >
              Ver funcionalidades
            </Link>
          }
        />

        {/* Trust bar */}
        <div className="max-w-7xl mx-auto px-4 pb-16 flex flex-col items-center gap-4">
          <p className="text-xs text-[var(--shina-text-tertiary)] uppercase tracking-widest">
            Confiado por empresas líderes em mobilidade
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {LOGOS.map((logo) => (
              <span
                key={logo}
                className="text-sm font-semibold text-[var(--shina-text-tertiary)] hover:text-[var(--shina-text-secondary)] transition-colors"
              >
                {logo}
              </span>
            ))}
          </div>
        </div>

        {/* Features */}
        <section id="features" className="py-24 bg-[var(--shina-surface-deep)]/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <SectionTitle
              title={
                <>
                  Tudo que sua operação precisa,
                  <br />
                  <span className="text-gradient">em uma única plataforma</span>
                </>
              }
              description="Desde o agendamento de operações até análise avançada com IA — cada módulo foi desenhado para escalar com o seu negócio."
            />
            <FeatureGrid features={FEATURES} />
          </div>
        </section>

        {/* Benefits */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
                  Resultados reais desde o<span className="text-gradient"> primeiro dia</span>
                </h2>
                <p className="text-[var(--shina-text-secondary)] text-lg mb-10 leading-relaxed">
                  Empresas que adotam o Shinã reduzem custos operacionais em até 28% e aumentam a
                  produtividade da frota em 40% nos primeiros 90 dias.
                </p>
                <ul className="space-y-3">
                  {BENEFITS.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-[var(--shina-text-secondary)] text-sm">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <GlassCard className="p-8 space-y-6">
                <div className="text-center mb-2">
                  <p className="text-xs text-[var(--shina-text-tertiary)] uppercase tracking-widest mb-1">
                    Resultados médios
                  </p>
                  <p className="text-sm text-[var(--shina-text-secondary)]">
                    Clientes Shinã após 90 dias
                  </p>
                </div>
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between border-b border-[var(--shina-border-subtle)] pb-4 last:border-0 last:pb-0"
                  >
                    <span className="text-sm text-[var(--shina-text-secondary)]">{stat.label}</span>
                    <span className="text-2xl font-black text-[var(--shina-accent)]">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </GlassCard>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="py-20 bg-[var(--shina-surface-deep)]/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <FeatureGrid features={TRUST_ITEMS} />
          </div>
        </section>

        {/* CTA */}
        <Cta
          title={
            <>
              Pronto para transformar
              <br />
              <span className="text-gradient">sua operação?</span>
            </>
          }
          description="Comece grátis, sem cartão de crédito. Configure sua conta em menos de 5 minutos e veja a diferença que a inteligência operacional faz."
          primaryCta={
            <a
              href={loginUrl}
              id="cta-section-primary"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--shina-primary)] hover:bg-[var(--shina-primary-hover)] text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-[var(--shina-primary)]/30 no-underline"
            >
              Acessar plataforma
              <ArrowRight size={20} />
            </a>
          }
          secondaryCta={
            <Link
              href="/pricing"
              id="cta-section-pricing"
              className="inline-flex items-center gap-2 px-8 py-4 border border-[var(--shina-border-default)] text-white font-semibold text-lg rounded-2xl hover:bg-[var(--shina-surface-glass-hover)] transition-colors no-underline"
            >
              Ver planos e preços
            </Link>
          }
        />
      </main>
      <Footer />
    </>
  );
}
