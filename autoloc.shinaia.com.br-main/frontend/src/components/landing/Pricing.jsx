import React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { useLead } from "@/context/LeadContext";
import { Reveal, Stagger, staggerItem } from "@/components/landing/motion";
import { trackEvent } from "@/lib/api";

export function Pricing() {
  const { t, lang } = useLang();
  const { openLead } = useLead();
  const p = t.pricing;

  const choose = (name) => { trackEvent("cta_click", { label: `pricing_${name}`, section: "pricing", locale: lang }); openLead(`pricing_${name}`); };

  return (
    <section id="pricing" className="relative mx-auto max-w-7xl overflow-hidden px-6 py-28 md:py-36">
      <div className="plasma left-[35%] top-[10%] h-[460px] w-[460px] bg-[#7000ff]/40" />
      <Reveal>
        <p className="mb-3 text-center font-mono text-xs font-bold uppercase tracking-[0.3em] text-gradient">{p.overline}</p>
        <h2 className="mx-auto max-w-2xl text-center font-display text-3xl font-bold tracking-tight md:text-5xl">{p.title}</h2>
        <p className="mt-4 text-center text-sm text-zinc-500">{p.note}</p>
      </Reveal>

      <Stagger className="mt-16 grid items-stretch gap-6 lg:grid-cols-3" stagger={0.12}>
        {p.plans.map((plan) => (
          <motion.div key={plan.name} variants={staggerItem}
            className={`relative flex flex-col rounded-3xl border p-8 ${plan.highlight ? "border-[#00E5FF]/50 bg-white/[0.05]" : "border-white/10 bg-white/[0.02]"}`}>
            {plan.highlight && (
              <>
                <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-[#00E5FF]/10 to-[#7000FF]/10 blur-xl" />
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7000FF] px-4 py-1 text-xs font-bold text-white">{p.badge}</span>
              </>
            )}
            <h3 className="font-display text-xl font-bold">{plan.name}</h3>
            <p className="mt-2 min-h-[40px] text-sm font-light text-zinc-400">{plan.d}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-4xl font-black text-white">{plan.price}</span>
              <span className="text-sm text-zinc-500">{plan.period}</span>
            </div>
            <ul className="mt-8 flex-1 space-y-3">
              {plan.feats.map((ft, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check size={16} className="shrink-0 text-[#00E5FF]" /> {ft}
                </li>
              ))}
            </ul>
            <button data-testid={`pricing-cta-${plan.name}`} onClick={() => choose(plan.name)}
              className={`mt-8 rounded-full px-6 py-3.5 font-semibold transition-all ${plan.highlight ? "btn-glow bg-gradient-to-r from-[#00E5FF] to-[#7000FF] text-white" : "border border-white/15 text-white hover:bg-white/5"}`}>
              {p.cta}
            </button>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}
