import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { Reveal } from "@/components/landing/motion";
import { trackEvent } from "@/lib/api";

export function FAQ() {
  const { t, lang } = useLang();
  const f = t.faq;
  const [open, setOpen] = useState(0);

  const toggle = (i) => {
    setOpen((prev) => (prev === i ? -1 : i));
    trackEvent("faq_open", { label: String(i), section: "faq", locale: lang });
  };

  return (
    <section id="faq" className="relative mx-auto max-w-4xl px-6 py-28 md:py-36">
      <Reveal>
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.3em] text-gradient">{f.overline}</p>
        <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">{f.title}</h2>
      </Reveal>

      <div className="mt-14 divide-y divide-white/10">
        {f.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={i} delay={i * 0.04}>
              <div>
                <button data-testid={`faq-item-${i}`} onClick={() => toggle(i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left">
                  <span className={`font-display text-lg font-semibold transition-colors md:text-xl ${isOpen ? "text-gradient" : "text-white"}`}>{item.q}</span>
                  <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className={`shrink-0 rounded-full border p-1.5 transition-colors ${isOpen ? "border-[#00E5FF]/50 text-[#00E5FF]" : "border-white/15 text-zinc-400"}`}>
                    <Plus size={18} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                      <p className="pb-6 pr-12 text-base font-light leading-relaxed text-zinc-400">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
