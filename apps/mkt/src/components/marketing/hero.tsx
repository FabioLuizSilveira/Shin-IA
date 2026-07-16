"use client";

// Hero do site institucional — copy preservada integralmente do original
// (Wave 3), reskin liquid glass com o mesmo padrão de animação de
// apps/web/(public).

import { motion } from "framer-motion";
import { Bot, ArrowRight } from "@shina/icons";

export function Hero() {
  return (
    <section className="relative pt-40 pb-24 px-4 overflow-hidden">
      {/* Mesmo vídeo de fundo do Hero de shinaia.com.br (apps/web),
          mesmo tratamento: overlay preto 40% + fade inferior alto. */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4"
          type="video/mp4"
        />
      </video>
      <div aria-hidden className="absolute inset-0 bg-black/40 z-0 pointer-events-none" />
      <div
        aria-hidden
        className="absolute bottom-0 left-0 w-full h-[300px] bg-gradient-to-b from-transparent to-black z-0 pointer-events-none"
      />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass text-xs font-body font-medium text-white/70 mb-8"
        >
          <Bot size={14} /> Agent-first: crie campanhas por linguagem natural
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-heading italic text-5xl sm:text-6xl lg:text-7xl text-white leading-[1.05] mb-6"
        >
          Anúncios vencedores, criados com IA
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-body text-lg text-white/85 [text-shadow:0_1px_16px_rgba(0,0,0,0.85)] max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Pesquise concorrentes, gere criativos com seu Brand Kit, clone referências e publique em
          Meta, Google, TikTok, LinkedIn, Reddit e X — com aprovação humana em cada etapa.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="/login"
            id="hero-cta-primary"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-body font-semibold rounded-full transition-transform hover:scale-[1.02] no-underline"
          >
            Começar grátis
            <ArrowRight size={20} />
          </a>
          <a
            href="/pricing"
            id="hero-cta-secondary"
            className="inline-flex items-center gap-2 px-8 py-4 liquid-glass text-white font-body font-semibold rounded-full transition-colors hover:bg-white/5 no-underline"
          >
            Ver planos
          </a>
        </motion.div>
      </div>
    </section>
  );
}
