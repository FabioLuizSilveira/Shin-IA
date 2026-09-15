"use client";

// Hero do site institucional — réplica do blueprint real da Autoloc
// (Hero.jsx): badge, headline em Unbounded com trecho em gradiente,
// card de status "ao vivo" e dois CTAs, sobre o fundo slate + grid + dois
// plasma blobs (não mais a aurora WebGL "wisp" preto/indigo do rebrand
// anterior).

import { motion } from "framer-motion";
import { useDemoLead } from "./demo-lead-context";

export function Hero() {
  const { open: openDemoLead } = useDemoLead();
  return (
    <section className="relative overflow-hidden pt-36 pb-16 px-4">
      <div className="grid-bg" />
      <div
        aria-hidden
        className="plasma left-[-8%] top-[10%] h-[420px] w-[420px] bg-[#0066ff] animate-pulse-glow"
      />
      <div
        aria-hidden
        className="plasma right-[-6%] top-[18%] h-[480px] w-[480px] bg-[#7000ff] animate-pulse-glow"
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-body font-medium text-white/70 mb-8"
        >
          <span className="h-2 w-2 rounded-full bg-[#00E5FF] shadow-[0_0_10px_#00E5FF]" />
          Gestão inteligente de ativos + operações
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-heading text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[0.98] text-white [text-wrap:balance]"
        >
          Sua operação
          <br />
          <span className="text-white/60">no piloto</span>{" "}
          <span className="text-gradient text-glow">automático.</span>
        </motion.h1>

        <div className="mt-11 flex flex-col lg:flex-row lg:items-end justify-between gap-10">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-body text-base sm:text-lg text-white/70 leading-relaxed max-w-lg"
          >
            A Shinã IA conecta, automatiza e escala a operação de ativos físicos e digitais em um
            único ecossistema inteligente — contratos, ativos, financeiro e decisões, em um só
            lugar.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="glass rounded-2xl px-6 py-5 min-w-[260px] shrink-0"
          >
            {["Ativos monitorados · ao vivo", "6 setores conectados", "IA operando 24/7"].map(
              (row) => (
                <div
                  key={row}
                  className="flex items-center gap-2.5 text-sm text-white/70 mb-3.5 last:mb-0"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF] shrink-0" />
                  {row}
                </div>
              ),
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <button
            type="button"
            onClick={() => openDemoLead("hero")}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-body font-semibold text-sm text-[#04040a] bg-gradient-to-r from-[#00E5FF] to-[#7000FF] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,229,255,0.35)] border-0 cursor-pointer"
          >
            Conheça a plataforma →
          </button>
          <a
            href="#plataforma"
            className="glass inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-body font-semibold text-sm text-white no-underline"
          >
            ▷ Ver como funciona
          </a>
        </motion.div>
      </div>
    </section>
  );
}
