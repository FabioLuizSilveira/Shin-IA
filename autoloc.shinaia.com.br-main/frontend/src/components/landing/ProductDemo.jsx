import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Building2, User } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { Reveal } from "@/components/landing/motion";
import { trackEvent } from "@/lib/api";

const SHOWROOM = "/veloz-lot-night.jpg";
const DRIVER = "/locatario-app.jpg";

export function ProductDemo() {
  const { t, lang } = useLang();
  const p = t.product;
  const [tab, setTab] = useState("owner");
  const items = tab === "owner" ? p.owner : p.renter;
  const img = tab === "owner" ? SHOWROOM : DRIVER;

  const switchTab = (v) => { setTab(v); trackEvent("product_tab", { label: v, section: "product", locale: lang }); };

  return (
    <section id="product" className="relative mx-auto max-w-7xl px-6 py-28 md:py-36">
      <div className="plasma right-[10%] top-[10%] h-[420px] w-[420px] bg-[#0066ff]/40" />
      <Reveal>
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.3em] text-gradient">{p.overline}</p>
        <h2 className="max-w-3xl font-display text-3xl font-bold tracking-tight md:text-5xl">{p.title}</h2>
        <p className="mt-5 max-w-2xl text-base font-light text-zinc-400 md:text-lg">{p.d}</p>
      </Reveal>

      <div className="mt-12 inline-flex rounded-full border border-white/10 bg-white/5 p-1.5">
        <button data-testid="product-tab-owner" onClick={() => switchTab("owner")}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${tab === "owner" ? "bg-gradient-to-r from-[#00E5FF] to-[#7000FF] text-white" : "text-zinc-400 hover:text-white"}`}>
          <Building2 size={16} /> {p.tabOwner}
        </button>
        <button data-testid="product-tab-renter" onClick={() => switchTab("renter")}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${tab === "renter" ? "bg-gradient-to-r from-[#00E5FF] to-[#7000FF] text-white" : "text-zinc-400 hover:text-white"}`}>
          <User size={16} /> {p.tabRenter}
        </button>
      </div>

      <div className="mt-10 grid items-center gap-12 lg:grid-cols-2">
        <div className="relative order-2 lg:order-1">
          <AnimatePresence mode="wait">
            <motion.ul key={tab}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
              className="space-y-4">
              {items.map((it, i) => (
                <motion.li key={i}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00E5FF] to-[#7000FF]">
                    <Check size={14} className="text-white" />
                  </span>
                  <span className="text-sm font-medium text-zinc-200 md:text-base">{it}</span>
                </motion.li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>

        <div className="relative order-1 lg:order-2">
          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#00E5FF]/20 to-[#7000FF]/20 blur-2xl" />
              <img src={img} alt={p.title} loading="lazy"
                className="aspect-[4/3] w-full rounded-[2rem] border border-white/10 object-cover" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
