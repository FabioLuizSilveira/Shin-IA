"use client";

// "Como Funciona" — linhas alternadas texto/mídia (padrão "chess").

import { motion } from "framer-motion";
import { Layers, Brain, ShieldCheck } from "@shina/icons";
import { CosmicBackground } from "./cosmic-background";

export function FeaturesChess() {
  return (
    <section id="plataforma" className="relative py-24 px-4 overflow-hidden">
      <CosmicBackground fadeTop fadeBottom />

      <div className="relative z-10 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-body font-medium uppercase tracking-widest text-white/70 mb-4">
            Como Funciona
          </p>
          <h2 className="font-heading italic text-4xl sm:text-5xl text-white">
            Um único ecossistema para toda a operação.
          </h2>
        </motion.div>

        {/* Linha 1 — full width */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="liquid-glass rounded-3xl p-10 mb-8 flex flex-col md:flex-row items-center gap-8"
        >
          <div className="w-16 h-16 rounded-2xl liquid-glass-strong flex items-center justify-center shrink-0">
            <Layers size={28} className="text-white" />
          </div>
          <div>
            <h3 className="font-body font-semibold text-xl text-white mb-2">
              Plataforma Multi-Tenant
            </h3>
            <p className="font-body text-white/80 leading-relaxed">
              Múltiplas unidades de negócio operando na mesma infraestrutura, com isolamento de
              dados e controle centralizado.
            </p>
          </div>
        </motion.div>

        {/* Linha 2 — duas colunas */}
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="liquid-glass rounded-3xl p-10"
          >
            <div className="w-16 h-16 rounded-2xl liquid-glass-strong flex items-center justify-center mb-6">
              <Brain size={28} className="text-white" />
            </div>
            <h3 className="font-body font-semibold text-xl text-white mb-2">
              Inteligência Operacional
            </h3>
            <p className="font-body text-white/80 leading-relaxed">
              IA aplicada aos dados da operação para antecipar decisões.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="liquid-glass rounded-3xl p-10"
          >
            <div className="w-16 h-16 rounded-2xl liquid-glass-strong flex items-center justify-center mb-6">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h3 className="font-body font-semibold text-xl text-white mb-2">
              Automação com Governança
            </h3>
            <p className="font-body text-white/80 leading-relaxed">
              Fluxos automatizados com aprovação humana e auditoria completa.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
