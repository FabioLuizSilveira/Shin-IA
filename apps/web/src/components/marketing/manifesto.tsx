"use client";

// Manifesto em 3 capítulos numerados (problema → promessa → solução) —
// réplica do blueprint real da Autoloc (Manifesto.jsx).

import { motion } from "framer-motion";

const CHAPTERS = [
  {
    n: "01",
    title: "Sua operação vive em planilhas, grupos de WhatsApp e no que alguém lembra.",
    body: "Dados espalhados, decisões atrasadas, retrabalho que ninguém vê até o prejuízo chegar.",
  },
  {
    n: "02",
    title: "E se cada ativo, contrato e operação falasse a mesma língua?",
    body: "Um único ecossistema que conecta o que acontece no campo, na obra, na frota ou na fábrica com o que acontece na tela.",
  },
  {
    n: "03",
    title: "A Shinã IA conecta, automatiza e escala.",
    body: "Inteligência operacional em tempo real, governança em cada fluxo, arquitetura pronta para crescer com você.",
  },
];

export function Manifesto() {
  return (
    <section className="py-20 sm:py-28 px-4">
      <div className="max-w-4xl mx-auto space-y-16">
        {CHAPTERS.map((c, idx) => (
          <motion.div
            key={c.n}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: idx * 0.05 }}
            className="grid gap-5 md:grid-cols-[auto_1fr] md:gap-14 border-t border-white/10 pt-9"
          >
            <span className="font-heading font-black text-5xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-br from-[#4df2ff]/70 to-[#c39bff]/70">
              {c.n}
            </span>
            <div className="max-w-3xl">
              <h3 className="font-heading font-bold text-2xl md:text-4xl leading-tight tracking-tight text-white [text-wrap:balance]">
                {c.title}
              </h3>
              <p className="mt-4 font-body text-base md:text-lg text-white/65 leading-relaxed">
                {c.body}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
