"use client";

// "Use suas próprias chaves de IA" — copy preservada integralmente do
// original (Wave 3), reskin liquid glass.

import { motion } from "framer-motion";
import { KeyRound } from "@shina/icons";
import { AmbientBackground } from "./ambient-background";

export function ByokSection() {
  return (
    <section className="relative py-24 px-4 overflow-hidden">
      {/* Sem cor/movimento atrás, o liquid-glass fica quase invisível sobre
          preto chapado — o fundo de seda dá o que o vidro precisa refratar. */}
      <AmbientBackground fadeTop fadeBottom />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="relative z-10 max-w-4xl mx-auto text-center liquid-glass rounded-3xl p-10"
      >
        <div className="w-12 h-12 rounded-2xl liquid-glass-strong flex items-center justify-center mx-auto mb-5">
          <KeyRound size={24} className="text-white" />
        </div>
        <h2 className="font-heading italic text-2xl sm:text-3xl text-white mb-3">
          Use suas próprias chaves de IA
        </h2>
        <p className="font-body text-white/80 max-w-xl mx-auto leading-relaxed">
          Anthropic, OpenAI, Gemini, DeepSeek, Groq e mais. Configure seus provedores, controle
          custos por workspace ou use os créditos incluídos no seu plano.
        </p>
      </motion.div>
    </section>
  );
}
