import React from "react";
import CountUp from "react-countup";
import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { useLead } from "@/context/LeadContext";
import { Reveal, Stagger, staggerItem } from "@/components/landing/motion";
import { trackEvent } from "@/lib/api";

export function SocialProof() {
  const { t, lang } = useLang();
  const { openLead } = useLead();
  const s = t.proof;

  const cta = () => { trackEvent("cta_click", { label: "proof_cta", section: "proof", locale: lang }); openLead("proof"); };

  return (
    <section id="proof" className="relative mx-auto max-w-7xl px-6 py-28 md:py-36">
      <Reveal>
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.3em] text-gradient">{s.overline}</p>
        <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">{s.title}</h2>
      </Reveal>

      {/* Metrics */}
      <div className="mt-16 grid grid-cols-2 gap-8 border-y border-white/10 py-12 md:grid-cols-4">
        {s.stats.map((st, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <div className="text-center md:text-left">
              <div className="font-display text-4xl font-black text-gradient md:text-5xl">
                <CountUp end={st.k} duration={2.2} separator="." enableScrollSpy scrollSpyOnce suffix={st.suffix} />
              </div>
              <div className="mt-2 text-xs text-zinc-500 md:text-sm">{st.l}</div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Testimonials */}
      <Stagger className="mt-16 grid gap-6 md:grid-cols-3" stagger={0.12}>
        {s.testimonials.map((tt, i) => (
          <motion.figure key={i} variants={staggerItem}
            className="glass flex flex-col justify-between rounded-3xl p-8">
            <div>
              <div className="mb-4 flex gap-1">
                {Array.from({ length: 5 }).map((_, k) => <Star key={k} size={16} className="fill-[#00E5FF] text-[#00E5FF]" />)}
              </div>
              <blockquote className="text-base font-light leading-relaxed text-zinc-200">“{tt.q}”</blockquote>
            </div>
            <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#00E5FF] to-[#7000FF] font-display text-sm font-bold">
                {tt.n.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{tt.n}</div>
                <div className="text-xs text-zinc-500">{tt.r}</div>
              </div>
            </figcaption>
          </motion.figure>
        ))}
      </Stagger>

      <Reveal delay={0.1}>
        <button data-testid="proof-cta" onClick={cta}
          className="btn-glow mt-14 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7000FF] px-7 py-3.5 font-semibold text-white">
          {s.cta} <ArrowRight size={18} />
        </button>
      </Reveal>
    </section>
  );
}
