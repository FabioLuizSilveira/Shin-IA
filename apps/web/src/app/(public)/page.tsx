// Rebrand liquid glass: landing institucional reconstruída sobre os
// componentes de components/marketing/, com conteúdo e estrutura adaptados
// do brief de marca Shinã IA (ver plano em .claude/plans). Distinto do
// Shinã Flow Design System usado no restante da plataforma — ver
// (public)/layout.tsx para o porquê.

import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { StartSection } from "@/components/marketing/start-section";
import { FeaturesChess } from "@/components/marketing/features-chess";
import { FeaturesGrid } from "@/components/marketing/features-grid";
import { Stats } from "@/components/marketing/stats";
import { WhyUs } from "@/components/marketing/why-us";
import { CtaFooter } from "@/components/marketing/cta-footer";

export const metadata: Metadata = {
  title: "Shinã IA — O Sistema Operacional da Economia de Ativos",
  description:
    "A Shinã IA conecta, automatiza e escala a operação de ativos físicos e digitais em um único ecossistema inteligente — do agronegócio à construção civil, da logística à indústria.",
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <StartSection />
        <FeaturesChess />
        <FeaturesGrid />
        <Stats />
        <WhyUs />
        <CtaFooter />
      </main>
    </>
  );
}
