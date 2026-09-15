"use client";

// CTA final (3 passos) + rodapé institucional. Mantra: "Conectar.
// Automatizar. Escalar." Restyle para o fundo/paleta real da Autoloc: sem
// AmbientBackground (shader "wisp"), plasma blob + grid-bg no lugar.

import { motion } from "framer-motion";
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
        <div aria-hidden className="grid-bg" />
        <div aria-hidden className="plasma left-[35%] top-[6%] h-[440px] w-[440px] bg-[#7000ff]" />

        <div className="relative z-10 max-w-4xl mx-auto text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="font-heading font-extrabold text-4xl sm:text-5xl text-white mb-4 [text-wrap:balance]"
          >
            Coloque sua operação no piloto automático.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-body text-white/60 text-lg"
          >
            Um caminho simples para colocar sua operação em movimento.
          </motion.p>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto grid md:grid-cols-3 gap-5 mb-16">
          {STEPS.map((step, idx) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: idx * 0.12 }}
              className="glass hover-lift rounded-2xl p-8"
            >
              <p className="font-heading font-black text-3xl text-white/25 mb-4">{step.number}</p>
              <h3 className="font-body font-semibold text-white mb-2">{step.title}</h3>
              <p className="font-body text-sm text-white/60 leading-relaxed">{step.description}</p>
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
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-body font-semibold text-sm text-[#04040a] bg-gradient-to-r from-[#00E5FF] to-[#7000FF] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,229,255,0.35)] border-0 cursor-pointer"
          >
            Agendar Demonstração
          </button>
          <a
            href="/contact"
            className="glass inline-flex items-center gap-2 px-8 py-4 rounded-full font-body font-semibold text-sm text-white no-underline"
          >
            Falar com um Especialista
          </a>
        </motion.div>
      </section>

      <Footer />
    </>
  );
}
