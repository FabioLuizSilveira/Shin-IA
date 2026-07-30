"use client";

// Hero do site institucional — headline serifada itálica (tagline oficial),
// dois CTAs e barra de setores-alvo, sobre fundo preto com aurora sutil.

import { motion } from "framer-motion";
import { appUrl } from "@/lib/domain";
import { WispBackground } from "./wisp-background";

const SECTORS = [
  "Locação de Ativos",
  "Construção Civil",
  "Agronegócio",
  "Logística",
  "Indústria",
  "Energia",
];

const DEMO_URL = appUrl("/login");

export function Hero() {
  return (
    <section className="relative pt-40 pb-24 px-4 overflow-hidden">
      {/* Fundo WebGL "wisp" (template Nexus, recolorido indigo/violeta) +
          overlay preto 40% + fade inferior alto para fundir com o preto. */}
      <div className="absolute inset-0 z-0">
        <WispBackground />
      </div>
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
          O Sistema Operacional da Economia de Ativos
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-heading italic text-5xl sm:text-6xl lg:text-7xl text-white leading-[1.05] mb-6"
        >
          Operações Inteligentes em Movimento.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-body text-lg text-white/85 [text-shadow:0_1px_16px_rgba(0,0,0,0.85)] max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          A Shinã IA conecta, automatiza e escala a operação de ativos físicos e digitais em um
          único ecossistema inteligente — do agronegócio à construção civil, da logística à
          indústria.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <a
            href={DEMO_URL}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-body font-semibold rounded-full transition-transform hover:scale-[1.02] no-underline"
          >
            Agendar Demonstração
          </a>
          <a
            href="#plataforma"
            className="inline-flex items-center gap-2 px-8 py-4 liquid-glass text-white font-body font-semibold rounded-full transition-colors hover:bg-white/5 no-underline"
          >
            Conhecer a Plataforma
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
        >
          {SECTORS.map((sector) => (
            <span
              key={sector}
              className="text-xs font-body uppercase tracking-widest text-white/65"
            >
              {sector}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
