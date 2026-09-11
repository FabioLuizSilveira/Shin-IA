import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { DiscoveryWizard } from "./discovery-wizard";

// WAVE 6 — the Discovery Wizard page. Not linked from the sidebar on
// purpose: this is a pilot surface, reachable by direct URL only, gated
// server-side by the `onboarding.discovery` feature flag (see
// GET /api/onboarding/discovery). No production cutover.
export default function TenantOnboardingDiscoveryPage() {
  return (
    <AppShell title="Descoberta da Operação">
      <SectionHeader
        title="Descoberta da Operação"
        description="Responda algumas perguntas sobre a sua operação para receber uma recomendação de plano e configuração — sem jargão técnico."
      />
      <DiscoveryWizard />
    </AppShell>
  );
}
