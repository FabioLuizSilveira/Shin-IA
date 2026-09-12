import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, ConversationStatus, Message } from "./types.js";

// WAVE 2 — Operational Inbox: conversation listing/detail, assignment and
// close. All tenant-scoped (every query filters by tenant_id, defense in
// depth alongside RLS) — spec section 4.

interface ConversationRow {
  id: string;
  tenant_id: string;
  messaging_channel_id: string;
  external_conversation_key: string | null;
  status: ConversationStatus;
  assigned_user_id: string | null;
  assigned_team_id: string | null;
  contact_id: string | null;
  customer_id: string | null;
  last_message_at: string | null;
}

function rowToConversation(r: ConversationRow): Conversation {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    messagingChannelId: r.messaging_channel_id,
    externalConversationKey: r.external_conversation_key,
    status: r.status,
    assignedUserId: r.assigned_user_id,
    assignedTeamId: r.assigned_team_id,
    contactId: r.contact_id,
    customerId: r.customer_id,
    lastMessageAt: r.last_message_at,
  };
}

export type ConversationFilter = "all" | "unassigned" | "mine" | "customers" | "leads" | "closed";

export interface ListConversationsInput {
  tenantId: string;
  filter?: ConversationFilter;
  userId?: string | null;
  search?: string | null;
  limit?: number;
  cursor?: string | null;
}

export async function listConversations(
  db: SupabaseClient,
  input: ListConversationsInput,
): Promise<Conversation[]> {
  let query = db.from("conversations").select("*").eq("tenant_id", input.tenantId);

  switch (input.filter) {
    case "unassigned":
      query = query.is("assigned_user_id", null).in("status", ["open", "pending"]);
      break;
    case "mine":
      if (input.userId) query = query.eq("assigned_user_id", input.userId);
      break;
    case "customers":
      query = query.not("customer_id", "is", null);
      break;
    case "leads":
      query = query.is("customer_id", null).not("contact_id", "is", null);
      break;
    case "closed":
      query = query.eq("status", "closed");
      break;
    default:
      query = query.in("status", ["open", "pending"]);
  }

  query = query.order("last_message_at", { ascending: false }).limit(input.limit ?? 50);
  const { data, error } = await query;
  if (error) throw error;
  return (data as ConversationRow[] | null)?.map(rowToConversation) ?? [];
}

export async function getConversation(
  db: SupabaseClient,
  tenantId: string,
  conversationId: string,
): Promise<Conversation | null> {
  const { data, error } = await db
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToConversation(data as ConversationRow) : null;
}

export async function listMessages(
  db: SupabaseClient,
  tenantId: string,
  conversationId: string,
  limit = 100,
): Promise<Message[]> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (
    (data as Array<{
      id: string;
      tenant_id: string;
      conversation_id: string;
      direction: Message["direction"];
      sender_type: Message["senderType"];
      sender_id: string | null;
      provider_message_id: string | null;
      type: Message["type"];
      body: string | null;
      media_ref: string | null;
      metadata: Record<string, unknown>;
      status: Message["status"];
      created_at: string;
    }> | null) ?? []
  ).map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    conversationId: r.conversation_id,
    direction: r.direction,
    senderType: r.sender_type,
    senderId: r.sender_id,
    providerMessageId: r.provider_message_id,
    type: r.type,
    body: r.body,
    mediaRef: r.media_ref,
    metadata: r.metadata,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function assignConversation(
  db: SupabaseClient,
  input: {
    tenantId: string;
    conversationId: string;
    userId: string | null;
    teamId?: string | null;
  },
): Promise<void> {
  const { error } = await db
    .from("conversations")
    .update({
      assigned_user_id: input.userId,
      assigned_team_id: input.teamId ?? null,
      status: input.userId ? "open" : "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId);
  if (error) throw error;
}

export async function closeConversation(
  db: SupabaseClient,
  input: { tenantId: string; conversationId: string },
): Promise<void> {
  const { error } = await db
    .from("conversations")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId);
  if (error) throw error;
}

export async function reopenConversation(
  db: SupabaseClient,
  input: { tenantId: string; conversationId: string },
): Promise<void> {
  const { error } = await db
    .from("conversations")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", input.conversationId)
    .eq("tenant_id", input.tenantId);
  if (error) throw error;
}

export interface UnreadSummary {
  conversationId: string;
  unreadCount: number;
}

/** "Unread" = inbound messages after the last outbound reply in that
 *  conversation (no separate read-receipt table — matches the Inbox-level
 *  granularity spec section 11 actually asks for). */
export async function getUnreadCounts(
  db: SupabaseClient,
  tenantId: string,
): Promise<UnreadSummary[]> {
  const { data: conversations } = await db
    .from("conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["open", "pending"]);

  const summaries: UnreadSummary[] = [];
  for (const c of conversations ?? []) {
    const { data: messages } = await db
      .from("messages")
      .select("direction")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: false })
      .limit(50);
    let count = 0;
    for (const m of messages ?? []) {
      if (m.direction === "outbound") break;
      count += 1;
    }
    if (count > 0) summaries.push({ conversationId: c.id, unreadCount: count });
  }
  return summaries;
}
