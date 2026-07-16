"use client";

// Grid dos 5 pilares da marca Shinã IA.

import { motion } from "framer-motion";
import { Brain, ShieldCheck, TrendingUp, Share2, Zap } from "@shina/icons";

const PILLARS = [
  {
    icon: <Brain size={24} />,
    title: "Inteligência",
    description: "IA que entende sua operação e antecipa decisões.",
  },
  {
    icon: <ShieldCheck size={24} />,
    title: "Confiabilidade",
    description: "Segurança, governança e auditoria em cada processo.",
  },
  {
    icon: <TrendingUp size={24} />,
    title: "Escalabilidade",
    description: "Arquitetura multi-tenant pronta para crescer com você.",
  },
  {
    icon: <Share2 size={24} />,
    title: "Conectividade",
    description: "Integrações que unem dados de toda a cadeia operacional.",
  },
  {
    icon: <Zap size={24} />,
    title: "Eficiência",
    description: "Automação que elimina retrabalho e reduz custos.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="solucoes" className="py-24 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {PILLARS.map((pillar, idx) => (
          <motion.div
            key={pillar.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            className="liquid-glass rounded-2xl p-6"
          >
            <div className="w-12 h-12 rounded-xl liquid-glass-strong flex items-center justify-center mb-5 text-white">
              {pillar.icon}
            </div>
            <h3 className="font-body font-semibold text-white mb-2">{pillar.title}</h3>
            <p className="font-body text-sm text-white/80 leading-relaxed">{pillar.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
