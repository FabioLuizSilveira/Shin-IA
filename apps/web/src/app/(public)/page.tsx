// Rebrand v2: landing institucional reconstruída sobre o blueprint real da
// LP Autoloc (autoloc.shinaia.com.br) — ver plano/conversa de redesign.
// Substitui o rebrand "liquid glass" anterior (Instrument Serif + fundo
// quase preto) mantendo o mesmo grupo de rotas (public)/, distinto do
// Shinã Flow Design System usado no restante da plataforma.

import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Manifesto } from "@/components/marketing/manifesto";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Benefits } from "@/components/marketing/benefits";
import { Marquee } from "@/components/marketing/marquee";
import { WhyUs } from "@/components/marketing/why-us";
import { Stats } from "@/components/marketing/stats";
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
        <Manifesto />
        <HowItWorks />
        <Benefits />
        <Marquee />
        <WhyUs />
        <Stats />
        <CtaFooter />
      </main>
    </>
  );
}
