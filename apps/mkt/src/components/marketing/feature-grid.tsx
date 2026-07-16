"use client";

// Grid de funcionalidades — copy original (Wave 3) preservada e expandida
// para refletir paridade completa com o AdKit (adkit.so), a base conceitual
// do produto: reporting granular, pesquisa de audiência, rastreamento de
// conversões e cobertura de plataforma (Reddit e X inclusos). Reskin
// liquid glass sobre fundo preto — sem o efeito cósmico animado.

import { motion } from "framer-motion";
import {
  Library,
  Sparkles,
  Copy,
  Bot,
  ShieldCheck,
  Plug,
  BarChart3,
  Search,
  Target,
} from "@shina/icons";

const FEATURES = [
  {
    icon: <Library size={22} />,
    title: "Ad Library",
    description:
      "Pesquise entre mais de 500 mil anúncios de mais de 1.000 anunciantes, identifique criativos vencedores e monte seu swipe file organizado por marca e plataforma.",
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
    icon: <Search size={22} />,
    title: "Pesquisa de Audiência",
    description:
      "Descubra interesses, palavras-chave e tópicos para refinar o targeting antes de publicar qualquer campanha.",
  },
  {
    icon: <BarChart3 size={22} />,
    title: "Relatórios & Analytics",
    description:
      "ROAS, CPC, CPA, impressões, cliques e conversões em tempo real. No Google, detalhe por posicionamento e termos de busca.",
  },
  {
    icon: <Target size={22} />,
    title: "Rastreamento de Conversões",
    description:
      "Configure o tracking de conversões do Google e envie eventos offline direto da plataforma, sem sair do fluxo.",
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
      "Nada vai ao ar sem aprovação humana. Validação de orçamento, preview de criativos e histórico completo das alterações da conta.",
  },
  {
    icon: <Plug size={22} />,
    title: "Integrações de Ads",
    description:
      "Meta Ads, Google Ads, TikTok, LinkedIn, Reddit e X. Leia performance e publique campanhas aprovadas direto da plataforma.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((feature, idx) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            className="liquid-glass rounded-2xl p-6"
          >
            <div className="w-12 h-12 rounded-xl liquid-glass-strong flex items-center justify-center mb-5 text-white">
              {feature.icon}
            </div>
            <h3 className="font-body font-semibold text-white mb-2">{feature.title}</h3>
            <p className="font-body text-sm text-white/80 leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
