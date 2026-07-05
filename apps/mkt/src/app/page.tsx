// Wave 3: landing reconstruída exclusivamente sobre @shina/landing +
// @shina/design-system + @shina/flow-engine. Copy e dados preservados
// integralmente do original.

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Hero, FeatureGrid } from "@shina/landing";
import { GlassCard } from "@shina/design-system";
import {
  Library,
  Sparkles,
  Copy,
  Bot,
  ShieldCheck,
  Plug,
  ArrowRight,
  KeyRound,
} from "@shina/icons";

const FEATURES = [
  {
    icon: <Library size={22} />,
    title: "Ad Library",
    description:
      "Pesquise anúncios de concorrentes, identifique criativos vencedores e monte seu swipe file organizado por marca e plataforma.",
  },
  {
    icon: <Sparkles size={22} />,
    title: "Gerador de Anúncios IA",
    description:
      "Gere anúncios estáticos a partir do seu Brand Kit em segundos, com variações automáticas e exportação para cada plataforma.",
  },
  {
    icon: <Copy size={22} />,
    title: "Ad Cloner",
    description:
      "Clone qualquer anúncio de referência e adapte layout, cores, textos e produto para a identidade da sua marca.",
  },
  {
    icon: <Bot size={22} />,
    title: "MCP Server",
    description:
      "Conecte Claude, Cursor, n8n e outros agentes. Crie campanhas por linguagem natural — sempre em modo rascunho.",
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "Safety Layer",
    description:
      "Nada vai ao ar sem aprovação humana. Validação de orçamento, preview de criativos e audit trail completo.",
  },
  {
    icon: <Plug size={22} />,
    title: "Integrações de Ads",
    description:
      "Meta Ads, Google Ads, TikTok e LinkedIn. Leia performance e publique campanhas aprovadas direto da plataforma.",
  },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero
          product="mkt"
          eyebrow={
            <>
              <Bot size={14} /> Agent-first: crie campanhas por linguagem natural
            </>
          }
          title={
            <>
              Anúncios vencedores,
              <br />
              <span className="text-gradient-mkt">criados com IA</span>
            </>
          }
          subtitle="Pesquise concorrentes, gere criativos com seu Brand Kit, clone referências e publique em Meta, Google e TikTok — com aprovação humana em cada etapa."
          primaryCta={
            <a
              href="/login"
              id="hero-cta-primary"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--shina-primary)] hover:bg-indigo-500 text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-[var(--shina-primary)]/30 no-underline"
            >
              Começar grátis
              <ArrowRight size={20} />
            </a>
          }
          secondaryCta={
            <a
              href="/pricing"
              id="hero-cta-secondary"
              className="inline-flex items-center gap-2 px-8 py-4 border border-[var(--shina-border-default)] hover:border-[var(--shina-border-strong)] text-white font-semibold text-lg rounded-2xl transition-all hover:bg-[var(--shina-surface-glass-hover)] no-underline"
            >
              Ver planos
            </a>
          }
        />

        <section id="features" className="max-w-6xl mx-auto px-4 mt-24">
          <FeatureGrid features={FEATURES} />
        </section>

        <section className="max-w-4xl mx-auto px-4 mt-24 text-center">
          <GlassCard className="p-10">
            <div className="w-12 h-12 rounded-2xl bg-[var(--shina-primary)]/10 flex items-center justify-center mx-auto mb-5">
              <KeyRound size={24} className="text-[var(--shina-accent)]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Use suas próprias chaves de IA
            </h2>
            <p className="text-[var(--shina-text-secondary)] max-w-xl mx-auto">
              Anthropic, OpenAI, Gemini, DeepSeek, Groq e mais. Configure seus provedores, controle
              custos por workspace ou use os créditos incluídos no seu plano.
            </p>
          </GlassCard>
        </section>
      </main>
      <Footer />
    </>
  );
}
