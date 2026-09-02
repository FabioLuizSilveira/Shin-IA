import React from "react";
import Marquee from "react-fast-marquee";
import { Satellite, Fingerprint, ScanLine } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { Reveal, Stagger, staggerItem } from "@/components/landing/motion";
import { motion } from "framer-motion";

const icons = [Satellite, Fingerprint, ScanLine];

export function Differentiators() {
  const { t } = useLang();
  const d = t.diff;

  return (
    <section id="differentiators" className="relative overflow-hidden py-28 md:py-36">
      {/* Editorial marquee */}
      <div className="mb-24 select-none">
        <Marquee speed={30} gradient={false} autoFill>
          {d.marquee.map((w, i) => (
            <span key={i} className="font-display text-6xl font-black text-stroke md:text-8xl">
              {w}<span className="mx-8 text-[#00E5FF]/40 text-stroke-none" style={{ WebkitTextStroke: 0, color: "rgba(0,229,255,0.35)" }}>·</span>
            </span>
          ))}
        </Marquee>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.3em] text-gradient">{d.overline}</p>
          <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">{d.title}</h2>
        </Reveal>

        <Stagger className="mt-16 grid gap-6 md:grid-cols-3" stagger={0.12}>
          {d.items.map((item, i) => {
            const Icon = icons[i];
            return (
              <motion.div key={i} variants={staggerItem}
                className="glass rounded-3xl p-8">
                <div className="mb-6 inline-flex rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-[#7000FF]/20 p-4">
                  <Icon size={24} className="text-white" />
                </div>
                <h3 className="font-display text-lg font-bold">{item.t}</h3>
                <p className="mt-3 text-sm font-light leading-relaxed text-zinc-400">{item.d}</p>
              </motion.div>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
