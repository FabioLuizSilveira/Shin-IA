import React from "react";
import { useLang } from "@/context/LangContext";
import { Reveal } from "@/components/landing/motion";

export function Manifesto() {
  const { t } = useLang();
  const man = t.manifesto;

  return (
    <section id="manifesto" className="relative mx-auto max-w-7xl px-6 py-28 md:py-40">
      <Reveal>
        <p className="mb-16 font-mono text-xs font-bold uppercase tracking-[0.3em] text-gradient">{man.overline}</p>
      </Reveal>

      <div className="space-y-24">
        {man.chapters.map((c, i) => (
          <Reveal key={c.n} delay={i * 0.05}>
            <div className="grid gap-6 border-t border-white/10 pt-10 md:grid-cols-[auto_1fr] md:gap-16">
              <span className="font-display text-6xl font-black text-white/10 md:text-8xl">{c.n}</span>
              <div className="max-w-3xl">
                <h3 className="font-display text-2xl font-bold leading-tight tracking-tight md:text-4xl">
                  {c.t}
                </h3>
                <p className="mt-5 text-base font-light leading-relaxed text-zinc-400 md:text-lg">{c.d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
