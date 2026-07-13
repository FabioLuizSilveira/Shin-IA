"use client";

// Seção de propósito ("Nosso Propósito") — por que a Shinã IA existe.

import { motion } from "framer-motion";
import { AmbientBackground } from "./ambient-background";

export function StartSection() {
  return (
    <section id="sobre" className="relative py-24 px-4 overflow-hidden">
      {/* Fundo de efeitos sem texto embutido — nítido, sem overlay escuro. */}
      <AmbientBackground fadeTop fadeBottom />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass text-xs font-body font-medium text-white/70 mb-8"
        >
          Nosso Propósito
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-heading italic text-4xl sm:text-5xl text-white mb-6"
        >
          Eliminamos ineficiências operacionais.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-body text-lg text-white/85 [text-shadow:0_1px_16px_rgba(0,0,0,0.85)] leading-relaxed mb-10"
        >
          Empresas que operam ativos físicos e digitais perdem tempo e dinheiro com processos
          manuais, sistemas fragmentados e falta de visibilidade. A Shinã IA existe para eliminar
          essa fricção: uma plataforma multi-tenant que conecta dados, automatiza decisões e coloca
          a operação em movimento — com governança e inteligência em cada etapa.
        </motion.p>

        <motion.a
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.3 }}
          href="/contact"
          className="inline-flex items-center gap-2 px-8 py-4 liquid-glass-strong text-white font-body font-semibold rounded-full transition-colors hover:bg-white/10 no-underline"
        >
          Falar com um Especialista
        </motion.a>
      </div>
    </section>
  );
}
