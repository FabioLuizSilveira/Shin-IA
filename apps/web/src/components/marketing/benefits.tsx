"use client";

// Bento grid dos 5 pilares da marca Shinã IA — substitui o grid uniforme
// de 5 colunas (features-grid.tsx) pelo layout assimétrico + hover (lift +
// wash gradiente cyan/roxo) do blueprint real da Autoloc (Benefits.jsx).

import { motion } from "framer-motion";
import { Brain, ShieldCheck, Share2, Zap, TrendingUp } from "@shina/icons";

const PILLARS = [
  {
    icon: <Brain size={22} className="text-[#00E5FF]" />,
    title: "Inteligência que entende sua operação",
    description:
      "IA treinada nos dados reais da sua operação antecipa decisões em vez de só registrar o que já aconteceu.",
    big: true,
  },
  {
    icon: <ShieldCheck size={22} className="text-[#00E5FF]" />,
    title: "Confiabilidade",
    description: "Segurança, governança e auditoria em cada processo.",
    big: false,
  },
  {
    icon: <Share2 size={22} className="text-[#00E5FF]" />,
    title: "Conectividade",
    description: "Integrações que unem dados de toda a cadeia operacional.",
    big: false,
  },
  {
    icon: <Zap size={22} className="text-[#00E5FF]" />,
    title: "Eficiência",
    description: "Automação que elimina retrabalho e reduz custos.",
    big: false,
  },
  {
    icon: <TrendingUp size={22} className="text-[#00E5FF]" />,
    title: "Escalabilidade multi-tenant",
    description:
      "Uma arquitetura, múltiplos setores — do agronegócio à indústria — pronta para crescer com você sem reescrever nada.",
    big: true,
  },
];

export function Benefits() {
  return (
    <section id="solucoes" className="relative overflow-hidden py-20 sm:py-28 px-4">
      <div aria-hidden className="plasma left-[16%] top-[24%] h-[400px] w-[400px] bg-[#7000ff]" />

      <div className="relative z-10 max-w-6xl mx-auto">
        <p className="font-data text-xs font-medium uppercase tracking-[0.22em] text-gradient mb-4">
          Benefícios
        </p>
        <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-white [text-wrap:balance] mb-12">
          Resultado, não só recurso.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          {PILLARS.map((pillar, idx) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: idx * 0.08 }}
              className={`glass hover-lift rounded-3xl p-7 ${pillar.big ? "lg:col-span-8" : "lg:col-span-4"}`}
            >
              <div className="w-11 h-11 rounded-xl glass-strong flex items-center justify-center mb-5">
                {pillar.icon}
              </div>
              <h3 className="font-body font-semibold text-white text-base mb-2">{pillar.title}</h3>
              <p className="font-body text-sm text-white/60 leading-relaxed">
                {pillar.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
