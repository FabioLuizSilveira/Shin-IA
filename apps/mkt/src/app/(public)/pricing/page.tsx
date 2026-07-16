// Rebrand liquid glass — copy e planos preservados integralmente do
// original (Wave 3).

import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { PricingSection } from "@/components/marketing/pricing-section";

export const metadata: Metadata = {
  title: "Preços",
  description:
    "Planos do Shinã Marketing IA: Starter, Pro e Business. 14 dias de trial grátis e escale com IA.",
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24 px-4">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="font-heading italic text-4xl sm:text-5xl text-white mb-4">
            Planos para cada fase da sua operação
          </h1>
          <p className="font-body text-white/85 [text-shadow:0_1px_16px_rgba(0,0,0,0.85)] text-lg">
            Comece com 14 dias de trial grátis, sem cartão de crédito. Faça upgrade quando precisar
            de mais volume, integrações ou agentes.
          </p>
        </div>

        <PricingSection />

        <p className="text-center text-xs font-body text-white/60 mt-10">
          Precisa de Enterprise? SSO, SLA 99,99%, workspaces ilimitados e suporte dedicado —{" "}
          <a href="mailto:contato@shinaia.com.br" className="text-white/80 hover:text-white">
            fale com a gente
          </a>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}
