import React from "react";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/context/LangContext";
import { useLead } from "@/context/LeadContext";
import { Reveal } from "@/components/landing/motion";
import { trackEvent } from "@/lib/api";
import { BRAND_LOGO } from "@/lib/config";

export function FinalCTA() {
  const { t, lang } = useLang();
  const { openLead } = useLead();
  const f = t.final;

  const primary = () => { trackEvent("cta_click", { label: "final_primary", section: "final", locale: lang }); openLead("final"); };

  return (
    <section className="relative mx-auto max-w-7xl px-6 py-20 md:py-28">
      <Reveal>
        <div className="glass relative overflow-hidden rounded-[2.5rem] px-8 py-20 text-center md:px-16 md:py-28">
          <div className="plasma left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 bg-[#7000ff]/50 animate-pulse-glow" />
          <img src={BRAND_LOGO} alt="Shinã I.A." className="relative mx-auto mb-8 h-20 w-20 object-contain animate-float" />
          <h2 className="relative mx-auto max-w-3xl font-display text-3xl font-black leading-tight tracking-tight text-glow md:text-6xl">{f.title}</h2>
          <p className="relative mx-auto mt-6 max-w-xl text-base font-light text-zinc-300 md:text-lg">{f.d}</p>
          <div className="relative mt-10 flex justify-center">
            <button data-testid="final-cta-primary" onClick={primary}
              className="btn-glow flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7000FF] px-8 py-4 font-semibold text-white">
              {f.ctaPrimary} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
