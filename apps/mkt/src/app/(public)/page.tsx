// Rebrand liquid glass: mesmo tratamento visual aplicado em apps/web/(public),
// com o conteúdo integralmente preservado do original (Wave 3) — apenas a
// implementação visual muda.

import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { ByokSection } from "@/components/marketing/byok-section";
import { Footer } from "@/components/marketing/footer";

export const metadata: Metadata = {
  title: "Shinã Marketing IA — Anúncios vencedores com IA",
  description:
    "Crie, clone e publique anúncios com IA. Ad Library de concorrentes, gerador de criativos, relatórios, pesquisa de audiência, MCP Server para agentes e integração com Meta, Google, TikTok, LinkedIn, Reddit e X Ads.",
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <FeatureGrid />
        <ByokSection />
      </main>
      <Footer />
    </>
  );
}
