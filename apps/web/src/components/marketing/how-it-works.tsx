"use client";

// "Como Funciona" — cabeçalho fixo + trilha de 4 passos que acende
// conforme rola a tela (IntersectionObserver via useState/useEffect).
// Substitui o antigo FeaturesChess (linhas alternadas sobre a nebulosa
// CosmicBackground) pelo blueprint real da Autoloc (HowItWorks.jsx).

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    tag: "Passo 1 · Operador",
    title: "Cadastre seus ativos",
    body: "Veículos, máquinas, equipamentos — com tipo, capacidade e documentação, prontos para operar.",
  },
  {
    n: "02",
    tag: "Passo 2 · Operador",
    title: "Configure contratos e regras",
    body: "Locação, manutenção, vistoria — a Shinã aplica as regras da sua operação automaticamente.",
  },
  {
    n: "03",
    tag: "Passo 3 · Shinã IA",
    title: "A IA acompanha em tempo real",
    body: "Rastreamento, alertas de manutenção e insights operacionais, sem precisar perguntar.",
  },
  {
    n: "04",
    tag: "Passo 4 · Gestão",
    title: "Decida com dados, não com achismo",
    body: "Relatórios, comissões e financeiro consolidados — a operação inteira em um painel.",
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = refs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActive(idx);
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section id="plataforma" className="py-20 sm:py-28 px-4">
      <div className="max-w-6xl mx-auto grid gap-12 lg:grid-cols-[0.9fr_1.4fr]">
        <div className="lg:sticky lg:top-24 self-start">
          <p className="font-data text-xs font-medium uppercase tracking-[0.22em] text-gradient mb-4">
            Como funciona
          </p>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-white [text-wrap:balance]">
            De ativo parado a operação inteligente.
          </h2>
          <p className="mt-4 font-body text-sm text-white/60 leading-relaxed max-w-sm">
            O mesmo fluxo atende quem opera a frota e quem administra o negócio — cada lado vê
            exatamente o que precisa.
          </p>
        </div>

        <div>
          {STEPS.map((step, idx) => (
            <motion.div
              key={step.n}
              ref={(el) => {
                refs.current[idx] = el;
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="relative flex gap-5 py-6 pl-7 -ml-5 border-l-2 rounded-r-2xl transition-colors duration-300"
              style={{
                borderColor: active === idx ? "var(--cyan)" : "var(--border-subtle)",
                background: active === idx ? "rgba(255,255,255,0.03)" : "transparent",
              }}
            >
              <span
                aria-hidden
                className="absolute -left-[7px] top-[30px] h-3 w-3 rounded-full border-2 transition-all duration-300"
                style={{
                  background: active === idx ? "var(--cyan)" : "var(--bg-elevated)",
                  borderColor: active === idx ? "var(--cyan)" : "rgba(255,255,255,0.4)",
                  boxShadow: active === idx ? "0 0 12px var(--cyan)" : "none",
                }}
              />
              <div>
                <p
                  className="font-data text-[0.68rem] uppercase tracking-[0.14em] mb-1.5 transition-colors duration-300"
                  style={{ color: active === idx ? "var(--cyan)" : "rgba(255,255,255,0.4)" }}
                >
                  {step.tag}
                </p>
                <h4 className="font-body font-semibold text-lg text-white mb-1.5">{step.title}</h4>
                <p className="font-body text-sm text-white/60 leading-relaxed">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
