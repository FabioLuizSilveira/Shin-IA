import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
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
} from "lucide-react";

export const metadata: Metadata = {
  title: "Shinã — Plataforma de Inteligência Operacional para Frotas",
  description:
    "Gerencie frota, operações e equipes com inteligência artificial. Dashboards em tempo real, automação e insights poderosos para empresas de mobilidade e logística.",
};

// ── Feature data ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Zap,
    title: "Operações em tempo real",
    description:
      "Gerencie agendamentos, despachos e status de cada operação em uma única tela, com atualizações ao vivo.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Truck,
    title: "Gestão de Frota & Ativos",
    description:
      "Controle veículos, equipamentos e tecnologia. Métricas de utilização, manutenção e disponibilidade instantâneas.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: Brain,
    title: "AI Center",
    description:
      "Insights gerados por IA: resumos executivos, detecção de anomalias, previsão de demanda e sugestões de otimização.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Users,
    title: "CRM & Equipes",
    description:
      "Gerencie clientes, parceiros, fornecedores e toda a sua equipe. Convide membros, defina papéis e acompanhe o desempenho.",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    icon: FileText,
    title: "Contratos & Financeiro",
    description:
      "Controle contratos, faturas, comissões e fluxo de caixa. Relatórios financeiros automáticos e alertas de vencimento.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: BarChart3,
    title: "Analytics Avançado",
    description:
      "Dashboards interativos com KPIs customizáveis. Visualize tendências, compare períodos e tome decisões orientadas a dados.",
    color: "text-red-400",
    bg: "bg-red-500/10",
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

const LOGOS = [
  "Transportes Brasil",
  "LogiTech S.A.",
  "Mobilidade Verde",
  "Frota Express",
  "AgriFleet",
  "HealthMove",
];

// ── Sections ──────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background glow */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          Plataforma de nova geração para gestão operacional
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-none">
          Inteligência operacional
          <br />
          <span className="text-gradient">para a sua frota</span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-400 mb-10 leading-relaxed">
          Shinã é a plataforma SaaS com IA que unifica gestão de frota, operações, CRM, financeiro e
          análise em um único lugar. Do agendamento ao insight, tudo conectado.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            href="/contact"
            id="hero-cta-primary"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 no-underline"
          >
            Começar agora grátis
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/#features"
            id="hero-cta-secondary"
            className="inline-flex items-center gap-2 px-8 py-4 border border-white/10 hover:border-white/20 text-white font-semibold text-lg rounded-2xl transition-all hover:bg-white/5 no-underline"
          >
            Ver funcionalidades
          </Link>
        </div>

        {/* Trust bar */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">
            Confiado por empresas líderes em mobilidade
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {LOGOS.map((logo) => (
              <span
                key={logo}
                className="text-sm font-semibold text-slate-600 hover:text-slate-400 transition"
              >
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
            Tudo que sua operação precisa,
            <br />
            <span className="text-gradient">em uma única plataforma</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Desde o agendamento de operações até análise avançada com IA — cada módulo foi desenhado
            para escalar com o seu negócio.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group card-glass rounded-2xl p-6 hover:bg-white/8 transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-5 ${feature.color}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
              Resultados reais desde o<span className="text-gradient"> primeiro dia</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              Empresas que adotam o Shinã reduzem custos operacionais em até 28% e aumentam a
              produtividade da frota em 40% nos primeiros 90 dias.
            </p>
            <ul className="space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 text-sm">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right — Stats card */}
          <div className="card-glass rounded-3xl p-8 space-y-6">
            <div className="text-center mb-2">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">
                Resultados médios
              </p>
              <p className="text-sm text-slate-400">Clientes Shinã após 90 dias</p>
            </div>
            {[
              { label: "Redução de custos operacionais", value: "28%", color: "text-green-400" },
              { label: "Aumento de produtividade da frota", value: "40%", color: "text-blue-400" },
              { label: "Tempo de onboarding", value: "<5min", color: "text-purple-400" },
              { label: "Uptime garantido por SLA", value: "99.9%", color: "text-cyan-400" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0"
              >
                <span className="text-sm text-slate-400">{stat.label}</span>
                <span className={`text-2xl font-black ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="py-20 bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: "Segurança enterprise",
              desc: "Criptografia end-to-end, RLS por tenant, backups automáticos e conformidade LGPD.",
            },
            {
              icon: Globe,
              title: "Multi-região",
              desc: "Infraestrutura distribuída globalmente via Supabase, com edge functions para baixa latência.",
            },
            {
              icon: Clock,
              title: "Suporte 24/7",
              desc: "Time dedicado de suporte técnico e sucesso do cliente para garantir sua operação.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="card-glass rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="card-glass rounded-3xl p-12 relative overflow-hidden">
          {/* Background glow */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10"
          />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
              Pronto para transformar
              <br />
              <span className="text-gradient">sua operação?</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
              Comece grátis, sem cartão de crédito. Configure sua conta em menos de 5 minutos e veja
              a diferença que a inteligência operacional faz.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                id="cta-section-primary"
                className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-blue-500/30 no-underline"
              >
                Começar agora grátis
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                id="cta-section-pricing"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/10 text-white font-semibold text-lg rounded-2xl hover:bg-white/5 transition no-underline"
              >
                Ver planos e preços
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <BenefitsSection />
        <TrustSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
