import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentPurpose, MessagingProvider } from "./types.js";
import { getOrCreateConversationForContact } from "./messaging-service.js";
import { sendOutboundText } from "./outbound.js";

// WAVE 3 — Shinã Workflows (spec section 16). The bridge from a domain
// event (contract ready, inspection requested, maintenance due, invoice
// due...) to a real WhatsApp message, WITHOUT any domain service ever
// importing a MessagingProvider itself (spec section 2's forbidden
// "MaintenanceService -> Meta API" shape). apps/web's createNotification()
// calls this — the SAME entry point every domain route already uses for
// in-app/push notifications, so extending it here means every existing
// call site (contracts, infractions, inspections, maintenance, signature
// requests...) gains WhatsApp reach without touching those routes.
//
// Uses the SAME "kind:id" recipient_external_ref convention
// create-notification.ts already writes (customer:<id> / operator:<id> /
// tenant:<id> broadcasts) — no second recipient-addressing scheme invented.

export interface NotifyContactInput {
  tenantId: string;
  /** "customer:<rental_customers.id>" | "operator:<operators.id>" — a
   *  tenant-wide broadcast ("tenant:<id>") is never sent over WhatsApp,
   *  only to a single identifiable contact. */
  recipientExternalRef: string;
  subject: string;
  body: string;
  /** A URL to append as a plain-text call-to-action — true interactive
   *  WhatsApp CTA buttons are a future enhancement (payload shape not
   *  verified against current docs yet). */
  ctaUrl?: string | null;
  purpose?: ConsentPurpose;
  /** The caller (apps/web) resolves this from getEntitlements() —
   *  notify.ts stays framework-agnostic and never queries plan/billing
   *  tables itself. Defaults to false (never silently bypasses the
   *  entitlement gate). */
  entitlementActive?: boolean;
}

export interface NotifyContactResult {
  sent: boolean;
  reason?: string;
  messageId?: string;
}

interface ChannelLookupRow {
  id: string;
}

async function resolvePhoneForRecipient(
  db: SupabaseClient,
  recipientExternalRef: string,
): Promise<{ phone: string | null; personId: string | null }> {
  const [kind, id] = recipientExternalRef.split(":");
  if (kind === "customer" && id) {
    const { data } = await db.from("rental_customers").select("phone").eq("id", id).maybeSingle();
    return { phone: (data?.phone as string) ?? null, personId: id };
  }
  if (kind === "operator" && id) {
    const { data } = await db.from("operators").select("phone").eq("id", id).maybeSingle();
    return { phone: (data?.phone as string) ?? null, personId: id };
  }
  return { phone: null, personId: null };
}

export async function notifyContactViaWhatsApp(
  db: SupabaseClient,
  provider: MessagingProvider,
  input: NotifyContactInput,
): Promise<NotifyContactResult> {
  const [kind] = input.recipientExternalRef.split(":");
  if (kind !== "customer" && kind !== "operator") {
    return {
      sent: false,
      reason: "only a single identifiable customer/operator can be reached over WhatsApp",
    };
  }

  const { phone, personId } = await resolvePhoneForRecipient(db, input.recipientExternalRef);
  if (!phone) return { sent: false, reason: "recipient has no phone on file" };

  const { data: channelRow } = await db
    .from("messaging_channels")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();
  if (!channelRow) return { sent: false, reason: "no connected WhatsApp channel for this tenant" };

  const channel = {
    id: (channelRow as ChannelLookupRow).id,
    tenantId: input.tenantId,
    provider: channelRow.provider,
    externalBusinessAccountId: channelRow.external_business_account_id,
    externalPhoneNumberId: channelRow.external_phone_number_id,
    externalAccountId: channelRow.external_account_id,
    displayPhoneNumber: channelRow.display_phone_number,
    displayName: channelRow.display_name,
    status: channelRow.status,
    connectionMode: channelRow.connection_mode,
    branchId: channelRow.branch_id,
    purpose: channelRow.purpose,
    createdAt: channelRow.created_at,
    connectedAt: channelRow.connected_at,
    disconnectedAt: channelRow.disconnected_at,
  } as Parameters<typeof getOrCreateConversationForContact>[1];

  const { conversationId } = await getOrCreateConversationForContact(db, channel, phone);

  const text = [input.subject, input.body, input.ctaUrl ?? null].filter(Boolean).join("\n\n");

  const result = await sendOutboundText(db, provider, {
    channel,
    conversationId,
    toExternalId: phone,
    body: text,
    personId,
    purpose: input.purpose ?? "operational",
    entitlementActive: input.entitlementActive ?? false,
    senderUserId: null,
  });

  if (result.policy.decision === "BLOCK") {
    return {
      sent: false,
      reason: result.policy.checks.find((c) => !c.passed)?.reason ?? "blocked by policy",
    };
  }
  return { sent: true, messageId: result.messageId };
}
