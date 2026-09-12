// Shinã Messaging Platform — canonical, provider-agnostic multi-tenant
// messaging domain (WAVE 1: Official WhatsApp Foundation). Modeled directly
// on @shina/signature-platform's own provider-boundary pattern: a narrow
// provider interface, an env-driven resolver with no silent default, and a
// gateway-agnostic DB-writing core (messaging-service.ts) that only ever
// consumes a CanonicalMessagingEvent, never a raw provider payload.
//
// Hard rule (enforced by keeping this file provider-nomenclature-free):
// nothing in this domain, or in any Shinã module that sends/receives
// messages, may reference Meta/WhatsApp-specific concepts — WABA, wamid,
// Graph API, phone_number_id verbatim naming, template component schema
// quirks. A concrete adapter (MetaWhatsAppProvider today) owns 100% of
// that translation in both directions and lives entirely under providers/.

export type MessagingProviderType = "fake" | "whatsapp";

export type MessagingChannelStatus =
  | "pending"
  | "connected"
  | "suspended"
  | "disconnected"
  | "error";

export type MessagingConnectionMode = "cloud_api" | "coexistence_if_supported";

export type ConversationStatus = "open" | "pending" | "closed" | "archived";

export type ParticipantType =
  | "customer"
  | "tenant_user"
  | "operator"
  | "system"
  | "ai_agent"
  | "unknown_contact";

export type MessageDirection = "inbound" | "outbound";

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "location"
  | "contact"
  | "template"
  | "interactive"
  | "system";

export type MessageStatus = "received" | "queued" | "sent" | "delivered" | "read" | "failed";

export type TemplateStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paused"
  | "disabled";

export type ConsentPurpose = "operational" | "transactional" | "support" | "marketing";
export type ConsentStatus = "granted" | "revoked" | "not_required_if_legally_applicable";

// ── domain records ──────────────────────────────────────────────────────
export interface MessagingChannel {
  id: string;
  tenantId: string;
  provider: string;
  externalBusinessAccountId: string | null;
  externalPhoneNumberId: string | null;
  externalAccountId: string | null;
  displayPhoneNumber: string | null;
  displayName: string | null;
  status: MessagingChannelStatus;
  connectionMode: MessagingConnectionMode;
  branchId: string | null;
  purpose: string | null;
  createdAt: string;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

export interface Conversation {
  id: string;
  tenantId: string;
  messagingChannelId: string;
  externalConversationKey: string | null;
  status: ConversationStatus;
  assignedUserId: string | null;
  assignedTeamId: string | null;
  contactId: string | null;
  customerId: string | null;
  lastMessageAt: string | null;
}

export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  direction: MessageDirection;
  senderType: ParticipantType;
  senderId: string | null;
  providerMessageId: string | null;
  type: MessageType;
  body: string | null;
  mediaRef: string | null;
  metadata: Record<string, unknown>;
  status: MessageStatus;
  createdAt: string;
}

// ── canonical events (the ONLY shape the DB-writing core consumes) ──────
export type MessagingEventKind =
  | "message_received"
  | "message_sent"
  | "message_delivered"
  | "message_read"
  | "message_failed"
  | "channel_connected"
  | "channel_disconnected"
  | "channel_suspended";

export interface CanonicalInboundMessage {
  externalConversationKey: string;
  externalSenderId: string;
  externalSenderName: string | null;
  providerMessageId: string;
  type: MessageType;
  body: string | null;
  mediaRef: string | null;
  occurredAt: string;
  raw: Record<string, unknown>;
}

export interface CanonicalStatusUpdate {
  providerMessageId: string;
  status: MessageStatus;
  occurredAt: string;
}

export interface CanonicalMessagingEvent {
  provider: string;
  providerEventId: string;
  eventType: string;
  kind: MessagingEventKind;
  /** Resolves to a messaging_channels row server-side — the ONLY tenant
   *  resolution path (spec section 4: never trust tenantId from a webhook
   *  payload or client request). */
  externalPhoneNumberId: string;
  inboundMessage?: CanonicalInboundMessage;
  statusUpdate?: CanonicalStatusUpdate;
  rawPayload: Record<string, unknown>;
}

export interface ApplyMessagingEventResult {
  duplicate: boolean;
  handled: boolean;
  messagingChannelId?: string;
  tenantId?: string;
  conversationId?: string;
  messageId?: string;
}

// ── outbound ─────────────────────────────────────────────────────────────
export interface SendTextInput {
  channel: MessagingChannel;
  toExternalId: string;
  body: string;
}

export interface SendTemplateInput {
  channel: MessagingChannel;
  toExternalId: string;
  templateName: string;
  languageCode: string;
  components: unknown[];
}

export interface SendMediaInput {
  channel: MessagingChannel;
  toExternalId: string;
  type: Extract<MessageType, "image" | "video" | "audio" | "document">;
  mediaRef: string;
  caption?: string;
}

export interface ProviderSendResult {
  providerMessageId: string;
}

export interface ChannelConnectionResult {
  externalBusinessAccountId: string;
  externalPhoneNumberId: string;
  externalAccountId: string | null;
  displayPhoneNumber: string | null;
  displayName: string | null;
}

export interface ChannelStatusResult {
  status: MessagingChannelStatus;
}

// The provider boundary. A concrete adapter (FakeMessagingProvider today;
// MetaWhatsAppProvider, credential-blocked pending real Meta app
// configuration) is the ONLY place allowed to know the underlying
// gateway's own nomenclature.
export interface MessagingProvider {
  readonly type: MessagingProviderType;

  /** Exchanges an Embedded-Signup-style authorization artifact for the
   *  identifiers needed to create a MessagingChannel. Never returns a
   *  long-lived token to the caller — that's persisted internally by the
   *  provider (or by messaging-service.ts, credential-storage TBD — see
   *  messaging_channel_credentials' own migration comment). */
  connectAccount(authArtifact: unknown): Promise<ChannelConnectionResult>;
  getChannelStatus(channel: MessagingChannel): Promise<ChannelStatusResult>;
  sendText(input: SendTextInput): Promise<ProviderSendResult>;
  sendTemplate(input: SendTemplateInput): Promise<ProviderSendResult>;
  sendMedia(input: SendMediaInput): Promise<ProviderSendResult>;
  markAsRead?(channel: MessagingChannel, providerMessageId: string): Promise<void>;
  /** Verifies + translates a raw webhook delivery into zero or more
   *  canonical events. Takes the RAW body text (never pre-parsed) plus
   *  headers — signature verification (Meta's X-Hub-Signature-256,
   *  HMAC-SHA256 over the exact raw bytes) is impossible once the body has
   *  already been JSON.parse()'d. The provider parses only AFTER verifying
   *  authenticity — never assumed by the caller. */
  verifyWebhook(rawBody: string, headers: Record<string, string | null>): boolean;
  normalizeWebhook(
    rawBody: string,
    headers: Record<string, string | null>,
  ): Promise<CanonicalMessagingEvent[]>;
  /** The GET verification handshake a messaging provider's webhook
   *  subscription setup requires (Meta: hub.mode/hub.verify_token/
   *  hub.challenge) — returns the challenge string to echo back, or null
   *  if verification fails. */
  verifyWebhookSubscription(query: Record<string, string | null>): string | null;
  disconnect(channel: MessagingChannel): Promise<void>;
}
