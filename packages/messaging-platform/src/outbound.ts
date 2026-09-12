import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentPurpose, MessagingChannel, MessagingProvider } from "./types.js";
import { evaluateSendPolicy, type PolicyEvaluation } from "./policy-engine.js";

export interface SendOutboundTextInput {
  channel: MessagingChannel;
  conversationId: string;
  toExternalId: string;
  body: string;
  personId: string | null;
  purpose: ConsentPurpose;
  entitlementActive: boolean;
  senderUserId: string | null;
}

export interface SendOutboundResult {
  policy: PolicyEvaluation;
  messageId?: string;
  providerMessageId?: string;
}

/**
 * The single outbound entry point (spec section 13): Domain Service ->
 * this -> MessagingPolicyEngine -> [ALLOW] -> MessagingProvider ->
 * message row + usage event. No domain module (Contract/Maintenance/
 * Infraction/etc.) is allowed to call a MessagingProvider directly.
 */
export async function sendOutboundText(
  db: SupabaseClient,
  provider: MessagingProvider,
  input: SendOutboundTextInput,
): Promise<SendOutboundResult> {
  const policy = await evaluateSendPolicy(db, {
    channel: input.channel,
    tenantId: input.channel.tenantId,
    personId: input.personId,
    purpose: input.purpose,
    entitlementActive: input.entitlementActive,
  });

  if (policy.decision === "BLOCK") return { policy };

  const { data: queued, error: queueError } = await db
    .from("messages")
    .insert({
      tenant_id: input.channel.tenantId,
      conversation_id: input.conversationId,
      direction: "outbound",
      sender_type: input.senderUserId ? "tenant_user" : "system",
      sender_id: input.senderUserId,
      type: "text",
      body: input.body,
      metadata: {},
      status: "queued",
    })
    .select("id")
    .single();
  if (queueError || !queued) throw queueError ?? new Error("failed to queue outbound message");

  try {
    const sent = await provider.sendText({
      channel: input.channel,
      toExternalId: input.toExternalId,
      body: input.body,
    });

    await db
      .from("messages")
      .update({ status: "sent", provider_message_id: sent.providerMessageId })
      .eq("id", queued.id);

    await db.from("messaging_usage_events").insert({
      tenant_id: input.channel.tenantId,
      channel: "whatsapp",
      provider: provider.type,
      message_type: "text",
      category: input.purpose,
      provider_message_id: sent.providerMessageId,
      conversation_id: input.conversationId,
    });

    await db
      .from("conversations")
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", input.conversationId);

    return { policy, messageId: queued.id, providerMessageId: sent.providerMessageId };
  } catch (err) {
    await db.from("messages").update({ status: "failed" }).eq("id", queued.id);
    throw err;
  }
}
