import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApplyMessagingEventResult,
  CanonicalMessagingEvent,
  MessagingChannel,
  MessagingChannelStatus,
  MessagingConnectionMode,
} from "./types.js";

// Gateway-agnostic DB-writing core — mirrors @shina/signature-platform's
// signature-service.ts shape exactly. Reads only a CanonicalMessagingEvent,
// never a raw provider payload (each provider's own normalizeWebhook() is
// where that parsing happens). Idempotency: logged into
// messaging_webhook_events FIRST, under a composite unique index on
// (provider, provider_event_id) — a duplicate-key error (23505) means this
// exact event was already processed.
//
// Tenant resolution (spec section 4, P0 absolute): the ONLY path from an
// inbound webhook to a tenant_id is externalPhoneNumberId ->
// messaging_channels.tenant_id, looked up here server-side. Nothing in
// this file ever reads a tenantId off the event/payload itself.

interface ChannelRow {
  id: string;
  tenant_id: string;
  provider: string;
  external_business_account_id: string | null;
  external_phone_number_id: string | null;
  external_account_id: string | null;
  display_phone_number: string | null;
  display_name: string | null;
  status: MessagingChannelStatus;
  connection_mode: MessagingConnectionMode;
  branch_id: string | null;
  purpose: string | null;
  created_at: string;
  connected_at: string | null;
  disconnected_at: string | null;
}

function rowToChannel(r: ChannelRow): MessagingChannel {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    provider: r.provider,
    externalBusinessAccountId: r.external_business_account_id,
    externalPhoneNumberId: r.external_phone_number_id,
    externalAccountId: r.external_account_id,
    displayPhoneNumber: r.display_phone_number,
    displayName: r.display_name,
    status: r.status,
    connectionMode: r.connection_mode,
    branchId: r.branch_id,
    purpose: r.purpose,
    createdAt: r.created_at,
    connectedAt: r.connected_at,
    disconnectedAt: r.disconnected_at,
  };
}

export async function createMessagingChannel(
  db: SupabaseClient,
  input: {
    tenantId: string;
    connectionMode?: MessagingConnectionMode;
    branchId?: string | null;
    purpose?: string | null;
  },
): Promise<MessagingChannel> {
  const { data, error } = await db
    .from("messaging_channels")
    .insert({
      tenant_id: input.tenantId,
      provider: "whatsapp",
      connection_mode: input.connectionMode ?? "cloud_api",
      branch_id: input.branchId ?? null,
      purpose: input.purpose ?? null,
      status: "pending",
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to create messaging channel");
  return rowToChannel(data as ChannelRow);
}

/** Records the identifiers returned by MessagingProvider.connectAccount()
 *  and flips the channel to connected. The access token itself is written
 *  separately to messaging_channel_credentials (never returned by this
 *  function, never logged). */
export async function markChannelConnected(
  db: SupabaseClient,
  channelId: string,
  connection: {
    externalBusinessAccountId: string;
    externalPhoneNumberId: string;
    externalAccountId: string | null;
    displayPhoneNumber: string | null;
    displayName: string | null;
  },
  accessToken: string,
): Promise<MessagingChannel> {
  const { data, error } = await db
    .from("messaging_channels")
    .update({
      external_business_account_id: connection.externalBusinessAccountId,
      external_phone_number_id: connection.externalPhoneNumberId,
      external_account_id: connection.externalAccountId,
      display_phone_number: connection.displayPhoneNumber,
      display_name: connection.displayName,
      status: "connected",
      connected_at: new Date().toISOString(),
    })
    .eq("id", channelId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to mark channel connected");

  await db
    .from("messaging_channel_credentials")
    .upsert(
      {
        messaging_channel_id: channelId,
        access_token: accessToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "messaging_channel_id" },
    );

  return rowToChannel(data as ChannelRow);
}

export async function getAccessTokenForChannel(
  db: SupabaseClient,
  messagingChannelId: string,
): Promise<string> {
  const { data, error } = await db
    .from("messaging_channel_credentials")
    .select("access_token")
    .eq("messaging_channel_id", messagingChannelId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.access_token) {
    throw new Error(`no access token stored for messaging channel ${messagingChannelId}`);
  }
  return data.access_token as string;
}

async function resolveChannelByExternalPhone(
  db: SupabaseClient,
  provider: string,
  externalPhoneNumberId: string,
): Promise<MessagingChannel | null> {
  const { data, error } = await db
    .from("messaging_channels")
    .select("*")
    .eq("provider", provider)
    .eq("external_phone_number_id", externalPhoneNumberId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToChannel(data as ChannelRow) : null;
}

async function findOrCreateConversation(
  db: SupabaseClient,
  channel: MessagingChannel,
  externalConversationKey: string,
): Promise<{ id: string }> {
  const { data: existing } = await db
    .from("conversations")
    .select("id")
    .eq("messaging_channel_id", channel.id)
    .eq("external_conversation_key", externalConversationKey)
    .in("status", ["open", "pending"])
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await db
    .from("conversations")
    .insert({
      tenant_id: channel.tenantId,
      messaging_channel_id: channel.id,
      external_conversation_key: externalConversationKey,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !created) throw error ?? new Error("failed to create conversation");
  return created;
}

async function ensureParticipant(
  db: SupabaseClient,
  tenantId: string,
  conversationId: string,
  externalWaId: string,
  displayName: string | null,
): Promise<void> {
  const { data: existing } = await db
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("external_wa_id", externalWaId)
    .maybeSingle();
  if (existing) return;
  await db.from("conversation_participants").insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    participant_type: "unknown_contact",
    external_wa_id: externalWaId,
    display_name: displayName,
  });
}

/**
 * Applies a canonical event to the DB. STOP conditions this enforces:
 * cross-tenant leakage (tenant is derived from the channel row, never the
 * event) and hash/duplicate-mismatch-ignored equivalents (idempotency log
 * inserted first, under a real unique constraint).
 */
export async function applyMessagingEvent(
  db: SupabaseClient,
  event: CanonicalMessagingEvent,
): Promise<ApplyMessagingEventResult> {
  const { data: logged, error: logError } = await db
    .from("messaging_webhook_events")
    .insert({
      provider: event.provider,
      provider_event_id: event.providerEventId,
      event_type: event.eventType,
      payload: event.rawPayload,
    })
    .select("id")
    .single();

  if (logError) {
    if (logError.code === "23505") return { duplicate: true, handled: false };
    throw new Error(`messaging event log failed: ${logError.message}`);
  }

  const channel = await resolveChannelByExternalPhone(
    db,
    event.provider,
    event.externalPhoneNumberId,
  );
  if (!channel) {
    await db
      .from("messaging_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", logged.id);
    return { duplicate: false, handled: false };
  }

  let conversationId: string | undefined;
  let messageId: string | undefined;

  if (event.kind === "message_received" && event.inboundMessage) {
    const im = event.inboundMessage;
    const conversation = await findOrCreateConversation(db, channel, im.externalConversationKey);
    conversationId = conversation.id;
    await ensureParticipant(
      db,
      channel.tenantId,
      conversation.id,
      im.externalSenderId,
      im.externalSenderName,
    );

    const { data: message, error: msgError } = await db
      .from("messages")
      .insert({
        tenant_id: channel.tenantId,
        conversation_id: conversation.id,
        direction: "inbound",
        sender_type: "unknown_contact",
        provider_message_id: im.providerMessageId,
        type: im.type,
        body: im.body,
        media_ref: im.mediaRef,
        metadata: { raw: im.raw },
        status: "received",
      })
      .select("id")
      .single();
    if (msgError) {
      // duplicate provider_message_id (redelivered webhook, different
      // provider_event_id) — not a failure, just already-handled.
      if (msgError.code !== "23505") throw new Error(`message insert failed: ${msgError.message}`);
    } else {
      messageId = message.id;
    }

    await db
      .from("conversations")
      .update({ last_message_at: im.occurredAt, updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
  } else if (event.statusUpdate) {
    const su = event.statusUpdate;
    const { data: updated } = await db
      .from("messages")
      .update({ status: su.status })
      .eq("provider_message_id", su.providerMessageId)
      .select("id, conversation_id")
      .maybeSingle();
    if (updated) {
      messageId = updated.id;
      conversationId = updated.conversation_id;
    }
  }

  await db
    .from("messaging_webhook_events")
    .update({ processed_at: new Date().toISOString(), messaging_channel_id: channel.id })
    .eq("id", logged.id);

  return {
    duplicate: false,
    handled: true,
    messagingChannelId: channel.id,
    tenantId: channel.tenantId,
    conversationId,
    messageId,
  };
}

export async function getMessagingChannel(
  db: SupabaseClient,
  input: { tenantId: string; channelId: string },
): Promise<MessagingChannel | null> {
  const { data, error } = await db
    .from("messaging_channels")
    .select("*")
    .eq("id", input.channelId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToChannel(data as ChannelRow) : null;
}

export async function listMessagingChannels(
  db: SupabaseClient,
  tenantId: string,
): Promise<MessagingChannel[]> {
  const { data, error } = await db
    .from("messaging_channels")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ChannelRow[] | null)?.map(rowToChannel) ?? [];
}
