import React from "react";
import { motion } from "framer-motion";
import { Wrench, ShieldCheck, Zap, Heart } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { Reveal, Stagger, staggerItem } from "@/components/landing/motion";

const icons = [Wrench, ShieldCheck, Zap, Heart];

export function Benefits() {
  const { t } = useLang();
  const b = t.benefits;

  return (
    <section id="benefits" className="relative mx-auto max-w-7xl overflow-hidden px-6 py-28 md:py-36">
      <div className="plasma left-[20%] top-[30%] h-[400px] w-[400px] bg-[#7000ff]/40" />
      <Reveal>
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.3em] text-gradient">{b.overline}</p>
        <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">{b.title}</h2>
      </Reveal>

      <Stagger className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-12" stagger={0.1}>
        {b.items.map((item, i) => {
          const Icon = icons[i];
          const span = i === 0 ? "lg:col-span-7" : i === 1 ? "lg:col-span-5" : i === 2 ? "lg:col-span-5" : "lg:col-span-7";
          return (
            <motion.div key={i} variants={staggerItem}
              whileHover={{ y: -6 }}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 ${span}`}>
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#00E5FF]/0 to-[#7000FF]/0 opacity-0 transition-opacity duration-500 group-hover:from-[#00E5FF]/10 group-hover:to-[#7000FF]/10 group-hover:opacity-100" />
              <div>
                <div className="mb-5 inline-flex rounded-xl border border-white/10 bg-white/5 p-3">
                  <Icon size={22} className="text-[#00E5FF]" />
                </div>
                <h3 className="font-display text-xl font-bold">{item.t}</h3>
                <p className="mt-3 max-w-md text-sm font-light leading-relaxed text-zinc-400">{item.d}</p>
              </div>
              <div className="mt-8 flex items-baseline gap-2">
                <span className="font-display text-4xl font-black text-gradient">{item.k}</span>
                <span className="text-xs text-zinc-500">{item.kl}</span>
              </div>
            </motion.div>
          );
        })}
      </Stagger>
    </section>
  );
}
