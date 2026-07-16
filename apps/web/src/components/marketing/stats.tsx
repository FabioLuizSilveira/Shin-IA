"use client";

// Métricas ilustrativas de operação sobre fundo escuro. O fundo animado
// substitui o vídeo do template original (que era dessaturado e a 40%).

import { motion } from "framer-motion";
import { AmbientBackground } from "./ambient-background";

const STATS = [
  { value: "+40%", label: "Eficiência Operacional Média*" },
  { value: "24/7", label: "Monitoramento Inteligente" },
  { value: "100%", label: "Rastreabilidade de Ativos" },
  { value: "1", label: "Plataforma Multi-Tenant" },
];

export function Stats() {
  return (
    <section id="setores" className="relative py-24 px-4 overflow-hidden">
      {/* Fundo dessaturado (como o vídeo do template no Stats), mais presente. */}
      <AmbientBackground opacity={60} desaturate fadeTop fadeBottom />

      <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
        {STATS.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            className="liquid-glass rounded-2xl p-8 text-center"
          >
            <p className="font-heading italic text-4xl sm:text-5xl text-white mb-2">{stat.value}</p>
            <p className="font-body text-sm text-white/80">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <p className="relative z-10 text-center text-xs font-body text-white/60 mt-6">
        *Valores ilustrativos — a validar com dados reais da operação.
      </p>
    </section>
  );
}
