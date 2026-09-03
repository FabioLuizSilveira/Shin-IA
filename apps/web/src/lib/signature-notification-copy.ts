import type { SignatureEventKind } from "@shina/signature-platform";

export type SignatureEventNotificationCopy =
  | {
      logOnly: false;
      subject: string;
      body: string;
      priority: "low" | "normal" | "high" | "critical";
    }
  | { logOnly: true };

// Pure mapping, isolated specifically so it's unit-testable — the six-way
// decision of "which signature event gets a tenant notification, with
// what copy and priority" has no other place in the codebase where it
// could be exercised without a live Clicksign webhook delivery (which
// this environment can't produce). Kept in apps/web, not
// @shina/signature-platform, because notification copy/policy is an
// app-layer concern the canonical package deliberately knows nothing
// about (see ApplySignatureEventResult's own comment). logOnly:true means
// only logActivity() should fire, no createNotification() — every real
// createNotification() call site elsewhere in this app only notifies on a
// terminal/meaningful state change, never on each step of a multi-step
// flow, and this mirrors that (per-signer viewed/signed events, and the
// request-sent confirmation, are logActivity-only).
export function getSignatureEventNotificationCopy(
  kind: SignatureEventKind,
): SignatureEventNotificationCopy | null {
  switch (kind) {
    case "signature_completed":
      return {
        logOnly: false,
        subject: "Contrato assinado",
        body: "Todos os signatários concluíram a assinatura eletrônica do contrato.",
        priority: "normal",
      };
    case "signer_refused":
      return {
        logOnly: false,
        subject: "Assinatura recusada",
        body: "Um signatário recusou assinar o contrato.",
        priority: "high",
      };
    case "signature_cancelled":
      return {
        logOnly: false,
        subject: "Assinatura cancelada",
        body: "A solicitação de assinatura eletrônica do contrato foi cancelada.",
        priority: "normal",
      };
    case "signature_expired":
      return {
        logOnly: false,
        subject: "Assinatura expirada",
        body: "O prazo para assinatura eletrônica do contrato expirou sem conclusão.",
        priority: "high",
      };
    case "signature_failed":
      return {
        logOnly: false,
        subject: "Falha na assinatura",
        body: "A assinatura eletrônica do contrato falhou.",
        priority: "high",
      };
    case "signer_viewed":
    case "signer_signed":
    case "signature_request_sent":
      return { logOnly: true };
    default:
      return null;
  }
}
