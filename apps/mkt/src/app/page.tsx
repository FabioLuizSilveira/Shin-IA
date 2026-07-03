import Link from "next/link";
import {
  Sparkles,
  Library,
  Copy,
  Bot,
  ShieldCheck,
  Plug,
  ArrowRight,
  KeyRound,
} from "lucide-react";

const FEATURES = [
  {
    icon: Library,
    title: "Ad Library",
    description:
      "Pesquise anúncios de concorrentes, identifique criativos vencedores e monte seu swipe file organizado por marca e plataforma.",
  },
  {
    icon: Sparkles,
    title: "Gerador de Anúncios IA",
    description:
      "Gere anúncios estáticos a partir do seu Brand Kit em segundos, com variações automáticas e exportação para cada plataforma.",
  },
  {
    icon: Copy,
    title: "Ad Cloner",
    description:
      "Clone qualquer anúncio de referência e adapte layout, cores, textos e produto para a identidade da sua marca.",
  },
  {
    icon: Bot,
    title: "MCP Server",
    description:
      "Conecte Claude, Cursor, n8n e outros agentes. Crie campanhas por linguagem natural — sempre em modo rascunho.",
  },
  {
    icon: ShieldCheck,
    title: "Safety Layer",
    description:
      "Nada vai ao ar sem aprovação humana. Validação de orçamento, preview de criativos e audit trail completo.",
  },
  {
    icon: Plug,
    title: "Integrações de Ads",
    description:
      "Meta Ads, Google Ads, TikTok e LinkedIn. Leia performance e publique campanhas aprovadas direto da plataforma.",
  },
];

export default function HomePage() {
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
          <nav className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors no-underline"
            >
              Preços
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-mkt-primary hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors no-underline"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="pt-32 pb-24">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-mkt-primary/10 blur-3xl" />
          </div>
          <div className="relative max-w-5xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-mkt-primary/10 border border-mkt-primary/20 text-mkt-glow text-sm font-medium mb-8">
              <Bot className="w-3.5 h-3.5" />
              Agent-first: crie campanhas por linguagem natural
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
              Anúncios vencedores,
              <br />
              <span className="text-gradient-mkt">criados com IA</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-slate-400 mb-10">
              Pesquise concorrentes, gere criativos com seu Brand Kit, clone referências e publique
              em Meta, Google e TikTok — com aprovação humana em cada etapa.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-mkt-primary hover:bg-indigo-500 text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-mkt-primary/30 no-underline"
              >
                Começar grátis
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/10 hover:border-white/20 text-white font-semibold text-lg rounded-2xl transition-all hover:bg-white/5 no-underline"
              >
                Ver planos
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 mt-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card-glass rounded-2xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-mkt-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-mkt-glow" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* BYOK */}
        <section className="max-w-4xl mx-auto px-4 mt-24 text-center">
          <div className="card-glass rounded-3xl p-10">
            <div className="w-12 h-12 rounded-2xl bg-mkt-primary/10 flex items-center justify-center mx-auto mb-5">
              <KeyRound className="w-6 h-6 text-mkt-glow" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Use suas próprias chaves de IA
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Anthropic, OpenAI, Gemini, DeepSeek, Groq e mais. Configure seus provedores, controle
              custos por workspace ou use os créditos incluídos no seu plano.
            </p>
          </div>
        </section>
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
