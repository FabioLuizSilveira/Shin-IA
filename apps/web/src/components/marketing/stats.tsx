"use client";

// Métricas ilustrativas de operação — restyle para o fundo/paleta real da
// Autoloc: sem o vídeo/shader dessaturado (AmbientBackground), plasma blob
// + grid-bg no lugar, tiles glass com hover, sem mudança de conteúdo.

import { motion } from "framer-motion";

const STATS = [
  { value: "+40%", label: "Eficiência Operacional Média*" },
  { value: "24/7", label: "Monitoramento Inteligente" },
  { value: "100%", label: "Rastreabilidade de Ativos" },
  { value: "1", label: "Plataforma Multi-Tenant" },
];

export function Stats() {
  return (
    <section id="setores" className="relative overflow-hidden py-20 sm:py-28 px-4">
      <div aria-hidden className="grid-bg" />
      <div aria-hidden className="plasma left-[30%] top-0 h-[380px] w-[380px] bg-[#0066ff]" />

      <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-5">
        {STATS.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <p className="font-heading font-extrabold text-4xl sm:text-5xl text-gradient mb-2">
              {stat.value}
            </p>
            <p className="font-body text-sm text-white/60">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <p className="relative z-10 text-center text-xs font-body text-white/40 mt-6">
        *Valores ilustrativos — a validar com dados reais da operação.
      </p>
    </section>
  );
}
