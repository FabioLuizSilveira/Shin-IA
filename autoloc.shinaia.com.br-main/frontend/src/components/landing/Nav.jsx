import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { useLead } from "@/context/LeadContext";
import { BRAND_LOGO, PLATFORM } from "@/lib/config";
import { trackEvent } from "@/lib/api";

const links = [
  { id: "product", href: "#product" },
  { id: "how", href: "#how" },
  { id: "benefits", href: "#benefits" },
  { id: "proof", href: "#proof" },
  { id: "pricing", href: "#pricing" },
];

export function Nav() {
  const { t, lang, toggle } = useLang();
  const { openLead } = useLead();
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goLogin = () => {
    trackEvent("cta_click", { label: "login", section: "nav", locale: lang });
    window.open(PLATFORM.login, "_blank", "noopener");
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${scrolled ? "glass" : "bg-transparent"}`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="#top" data-testid="nav-logo" className="flex items-center gap-2.5">
          <img src={BRAND_LOGO} alt="Shinã I.A." className="h-10 w-10 object-contain" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-bold tracking-tight">{t.brand.name}</span>
            <span className="mt-1 hidden text-[10px] tracking-wide text-zinc-400 sm:block">{t.brand.tagline}</span>
          </span>
        </a>

        <div className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <a key={l.id} href={l.href} data-testid={`nav-${l.id}`}
              className="text-sm text-zinc-400 transition-colors hover:text-white">
              {t.nav[l.id]}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button data-testid="lang-toggle" onClick={toggle}
            className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-[#00E5FF]/50 hover:text-white">
            <span className={lang === "pt" ? "text-[#00E5FF]" : ""}>PT</span>
            <span className="text-zinc-600">/</span>
            <span className={lang === "en" ? "text-[#00E5FF]" : ""}>EN</span>
          </button>
          <button data-testid="nav-login" onClick={goLogin}
            className="hidden rounded-full border border-[#00E5FF]/40 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#00E5FF]/10 hover:shadow-[0_0_24px_rgba(0,229,255,0.35)] sm:block">
            {t.nav.login}
          </button>
          <button data-testid="nav-cta" onClick={() => openLead("nav")}
            className="btn-glow hidden rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7000FF] px-5 py-2 text-sm font-semibold text-white md:block">
            {t.nav.cta}
          </button>
          <button data-testid="nav-mobile-toggle" onClick={() => setMobile((v) => !v)} className="text-white lg:hidden">
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="glass overflow-hidden lg:hidden">
            <div className="flex flex-col gap-4 px-6 py-6">
              {links.map((l) => (
                <a key={l.id} href={l.href} onClick={() => setMobile(false)} className="text-sm text-zinc-300">{t.nav[l.id]}</a>
              ))}
              <button onClick={goLogin} className="rounded-full border border-[#00E5FF]/40 px-5 py-2.5 text-sm font-semibold">{t.nav.login}</button>
              <button onClick={() => { setMobile(false); openLead("nav-mobile"); }} className="rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7000FF] px-5 py-2.5 text-sm font-semibold">{t.nav.cta}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
