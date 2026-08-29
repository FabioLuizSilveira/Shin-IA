import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { useLead } from "@/context/LeadContext";
import { MaskedLines } from "@/components/landing/motion";
import { trackEvent } from "@/lib/api";

const HERO_VIDEO_WEBM = "/hero-nav.webm";
const HERO_VIDEO_MP4 = "/hero-nav.mp4";
const HERO_POSTER = "/hero-nav-poster.jpg";

export function Hero() {
  const { t, lang } = useLang();
  const { openLead } = useLead();
  const h = t.hero;
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const carY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const carScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  const primary = () => { trackEvent("cta_click", { label: "hero_primary", section: "hero", locale: lang }); document.getElementById("product")?.scrollIntoView({ behavior: "smooth" }); };
  const secondary = () => { trackEvent("cta_click", { label: "hero_secondary", section: "hero", locale: lang }); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <section ref={ref} id="top" className="relative min-h-screen overflow-hidden pt-32">
      <div className="grid-bg absolute inset-0 z-0" />

      {/* plasma blobs */}
      <div className="plasma left-[-8%] top-[12%] h-[460px] w-[460px] bg-[#0066ff] animate-pulse-glow" />
      <div className="plasma right-[-6%] top-[28%] h-[520px] w-[520px] bg-[#7000ff] animate-pulse-glow" />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div style={{ y: textY }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300">
            <Sparkles size={13} className="text-[#00E5FF]" />
            {h.badge}
          </motion.div>

          <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tighter sm:text-6xl lg:text-7xl">
            <MaskedLines
              lines={[h.title[0], h.title[1], ""]}
              delay={0.3}
            />
            <span className="block overflow-hidden">
              <motion.span
                className="block text-gradient text-glow"
                initial={{ y: "110%" }} animate={{ y: "0%" }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}>
                {h.title[2]}
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8 }}
            className="mt-7 max-w-xl text-base font-light leading-relaxed text-zinc-400 md:text-lg">
            {h.sub}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: 0.8 }}
            className="mt-9 flex flex-wrap items-center gap-4">
            <button data-testid="hero-cta-primary" onClick={primary}
              className="btn-glow flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7000FF] px-7 py-3.5 font-semibold text-white">
              {h.ctaPrimary} <ArrowRight size={18} />
            </button>
            <button data-testid="hero-cta-secondary" onClick={secondary}
              className="flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/5">
              <Play size={16} className="text-[#00E5FF]" /> {h.ctaSecondary}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.8 }}
            className="mt-12 flex gap-8 border-t border-white/10 pt-8">
            {[[h.stat1, h.stat1l], [h.stat2, h.stat2l], [h.stat3, h.stat3l]].map(([k, l], i) => (
              <div key={i}>
                <div className="font-display text-2xl font-bold text-gradient">{k}</div>
                <div className="mt-1 text-xs text-zinc-500">{l}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Parallax car */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative">
          <motion.div style={{ y: carY, scale: carScale }} className="relative animate-float">
            <div className="absolute inset-0 -z-10 rounded-full bg-[#00E5FF]/20 blur-[100px]" />
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={HERO_POSTER}
              aria-label={lang === "pt" ? "Navegação pelo painel de gestão e pelo app do cliente" : "Walkthrough of the management dashboard and the customer app"}
              className="w-full rounded-[2rem] border border-white/10 object-cover shadow-2xl [mask-image:linear-gradient(to_bottom,black_80%,transparent)]"
            >
              <source src={HERO_VIDEO_WEBM} type="video/webm" />
              <source src={HERO_VIDEO_MP4} type="video/mp4" />
            </video>
          </motion.div>
          <div className="glass absolute -bottom-4 left-4 flex items-center gap-3 rounded-2xl px-5 py-3">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#00E5FF]" />
            <span className="text-sm font-medium text-white">{lang === "pt" ? "Frota ao vivo · 320 veículos" : "Live fleet · 320 vehicles"}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
