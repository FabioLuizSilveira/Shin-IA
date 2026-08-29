import React, { useEffect, useRef } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import { LangProvider } from "@/context/LangContext";
import { LeadProvider } from "@/context/LeadContext";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Manifesto } from "@/components/landing/Manifesto";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Benefits } from "@/components/landing/Benefits";
import { Differentiators } from "@/components/landing/Differentiators";
import { ProductDemo } from "@/components/landing/ProductDemo";
import { SocialProof } from "@/components/landing/SocialProof";
import { FAQ } from "@/components/landing/FAQ";
import { Pricing } from "@/components/landing/Pricing";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { FloatingWhatsApp } from "@/components/landing/FloatingWhatsApp";
import { trackEvent } from "@/lib/api";

function ScrollDepth() {
  const lenis = useLenis();
  useEffect(() => {
    if (lenis) window.__lenis = lenis;
  }, [lenis]);
  const marks = useRef({ 25: false, 50: false, 75: false, 100: false });
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const pct = Math.round(((h.scrollTop + h.clientHeight) / h.scrollHeight) * 100);
      [25, 50, 75, 100].forEach((m) => {
        if (pct >= m && !marks.current[m]) {
          marks.current[m] = true;
          trackEvent("scroll_depth", { label: `${m}`, value: m });
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return null;
}

export default function Landing() {
  useEffect(() => { trackEvent("page_view", { section: "landing" }); }, []);

  return (
    <LangProvider>
      <LeadProvider>
        <ReactLenis root options={{ lerp: 0.09, smoothWheel: true }}>
          <div className="App grain relative bg-[#101019]">
            <ScrollDepth />
            <Nav />
            <main>
              <Hero />
              <Manifesto />
              <HowItWorks />
              <Benefits />
              <Differentiators />
              <ProductDemo />
              <SocialProof />
              <FAQ />
              <Pricing />
              <FinalCTA />
            </main>
            <Footer />
            <FloatingWhatsApp />
          </div>
        </ReactLenis>
      </LeadProvider>
    </LangProvider>
  );
}
