"use client";

// "Por que a Shinã IA" — 3 pilares (não são depoimentos de clientes).
// Restyle para o fundo/paleta real da Autoloc: liquid-glass -> glass +
// hover-lift, sem mudança de conteúdo.

import { motion } from "framer-motion";
import { Cpu, ShieldCheck, Share2 } from "@shina/icons";

const REASONS = [
  {
    icon: <Cpu size={22} className="text-[#00E5FF]" />,
    eyebrow: "Inteligência Operacional",
    title: "IA que entende sua operação.",
    description:
      "Insights e decisões orientadas por dados em tempo real, direto do que acontece na sua operação.",
  },
  {
    icon: <ShieldCheck size={22} className="text-[#00E5FF]" />,
    eyebrow: "Governança & Confiabilidade",
    title: "Automação com controle total.",
    description: "Aprovação humana, auditoria completa e segurança em cada fluxo automatizado.",
  },
  {
    icon: <Share2 size={22} className="text-[#00E5FF]" />,
    eyebrow: "Arquitetura Conectada",
    title: "Construída para escalar.",
    description:
      "Estrutura multi-tenant, integrações e crescimento sem fricção conforme sua operação cresce.",
  },
];

export function WhyUs() {
  return (
    <section id="sobre" className="py-20 sm:py-28 px-4">
      <div className="max-w-5xl mx-auto text-center mb-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="glass inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-body font-medium text-white/70 mb-8"
        >
          Por que a Shinã IA
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-heading font-extrabold text-3xl sm:text-4xl text-white [text-wrap:balance]"
        >
          Inteligência, governança e escala.
        </motion.h2>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-5">
        {REASONS.map((reason, idx) => (
          <motion.div
            key={reason.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: idx * 0.15 }}
            className="glass hover-lift rounded-3xl p-8"
          >
            <div className="w-12 h-12 rounded-xl glass-strong flex items-center justify-center mb-6">
              {reason.icon}
            </div>
            <p className="font-data text-xs font-medium uppercase tracking-[0.16em] text-white/40 mb-3">
              {reason.eyebrow}
            </p>
            <h3 className="font-body font-semibold text-xl text-white mb-3">{reason.title}</h3>
            <p className="font-body text-sm text-white/60 leading-relaxed">{reason.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
