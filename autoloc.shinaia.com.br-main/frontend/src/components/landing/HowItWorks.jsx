import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { useLead } from "@/context/LeadContext";
import { Reveal, Stagger, staggerItem } from "@/components/landing/motion";
import { trackEvent } from "@/lib/api";

export function HowItWorks() {
  const { t, lang } = useLang();
  const { openLead } = useLead();
  const h = t.how;

  const cta = () => { trackEvent("cta_click", { label: "how_cta", section: "how", locale: lang }); openLead("how"); };

  return (
    <section id="how" className="relative mx-auto max-w-7xl px-6 py-28 md:py-36">
      <Reveal>
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.3em] text-gradient">{h.overline}</p>
        <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">{h.title}</h2>
      </Reveal>

      <Stagger className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4" stagger={0.12}>
        {h.steps.map((s) => (
          <motion.div key={s.n} variants={staggerItem}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-[#00E5FF]/40">
            <div className="absolute -right-6 -top-6 font-display text-7xl font-black text-white/[0.04] transition-colors group-hover:text-[#00E5FF]/10">{s.n}</div>
            <div className="relative">
              <div className="mb-6 h-px w-10 bg-gradient-to-r from-[#00E5FF] to-transparent" />
              <h3 className="font-display text-lg font-bold">{s.t}</h3>
              <p className="mt-3 text-sm font-light leading-relaxed text-zinc-400">{s.d}</p>
            </div>
          </motion.div>
        ))}
      </Stagger>

      <Reveal delay={0.1}>
        <button data-testid="how-cta" onClick={cta}
          className="mt-14 inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 font-semibold transition-colors hover:bg-white/5">
          {h.cta} <ArrowRight size={18} className="text-[#00E5FF]" />
        </button>
      </Reveal>
    </section>
  );
}
