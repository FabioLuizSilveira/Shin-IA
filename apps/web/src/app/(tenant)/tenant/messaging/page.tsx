import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/ui/section-header";
import { MessagingInbox } from "./inbox";

// WAVE 2 — Operational Inbox page. Not linked from the sidebar yet
// (pilot-gated, same posture as the onboarding discovery wizard) — the
// route itself 403s until `messaging.whatsapp.enabled` is on and the
// tenant has a connected channel.
export default function TenantMessagingPage() {
  return (
    <AppShell title="Mensagens">
      <SectionHeader
        title="Mensagens"
        description="Conversas de WhatsApp com clientes e contatos, dentro da Shinã."
      />
      <MessagingInbox />
    </AppShell>
  );
}
