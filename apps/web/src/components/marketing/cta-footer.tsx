"use client";

// CTA final (3 passos) + rodapé institucional. Mantra: "Conectar.
// Automatizar. Escalar."

import { motion } from "framer-motion";
import { AmbientBackground } from "./ambient-background";
import { Footer } from "./footer";
import { useDemoLead } from "./demo-lead-context";

const STEPS = [
  {
    number: "01",
    title: "Diagnóstico",
    description: "Mapeamos seus ativos, processos e pontos de ineficiência.",
  },
  {
    number: "02",
    title: "Implementação",
    description: "Configuramos a plataforma multi-tenant para sua operação.",
  },
  {
    number: "03",
    title: "Escala",
    description: "Automação, governança e inteligência operando em conjunto.",
  },
];

export function CtaFooter() {
  const { open: openDemoLead } = useDemoLead();
  return (
    <>
      <section className="relative py-24 px-4 overflow-hidden">
        {/* Fundo de efeitos sem texto embutido — nítido, sem overlay escuro. */}
        <AmbientBackground fadeTop fadeBottomTall />

        <div className="relative z-10 max-w-4xl mx-auto text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="font-heading italic text-4xl sm:text-5xl text-white mb-4"
          >
            Comece a operar com inteligência.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-body text-white/80 text-lg"
          >
            Um caminho simples para colocar sua operação em movimento.
          </motion.p>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto grid md:grid-cols-3 gap-6 mb-16">
          {STEPS.map((step, idx) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: idx * 0.12 }}
              className="liquid-glass rounded-2xl p-8"
            >
              <p className="font-heading italic text-3xl text-white/30 mb-4">{step.number}</p>
              <h3 className="font-body font-semibold text-white mb-2">{step.title}</h3>
              <p className="font-body text-sm text-white/80 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            type="button"
            onClick={() => openDemoLead("cta-footer")}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-body font-semibold rounded-full transition-transform hover:scale-[1.02] border-0 cursor-pointer"
          >
            Agendar Demonstração
          </button>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 px-8 py-4 liquid-glass text-white font-body font-semibold rounded-full transition-colors hover:bg-white/5 no-underline"
          >
            Falar com um Especialista
          </a>
        </motion.div>
      </section>

      <Footer />
    </>
  );
}
