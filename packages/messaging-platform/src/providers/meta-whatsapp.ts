import { createHmac, timingSafeEqual } from "crypto";
import type {
  CanonicalInboundMessage,
  CanonicalMessagingEvent,
  CanonicalStatusUpdate,
  ChannelConnectionResult,
  ChannelStatusResult,
  MessageStatus,
  MessageType,
  MessagingChannel,
  MessagingProvider,
  ProviderSendResult,
  SendMediaInput,
  SendTemplateInput,
  SendTextInput,
} from "../types.js";

// MetaWhatsAppProvider — the real WhatsApp Business Platform / Cloud API
// adapter. Every shape below (webhook signature header/algorithm, the GET
// verification handshake, the send-message request/response shape, the
// inbound-message/status webhook payload nesting) was verified against
// Meta's current official developer documentation before writing this file
// (fetched live, not recalled from training data) — see the per-method
// comments for what was actually confirmed and what remains unverified.
//
// STOP-CONDITION COMPLIANCE (spec section 38): connectAccount() — the
// Embedded Signup authorization-code exchange — is NOT implemented here.
// That flow requires a real registered Meta App (App ID, a Facebook Login
// for Business configuration, App Review for the whatsapp_business_
// management/whatsapp_business_messaging permissions) that does not exist
// in this environment. Calling it throws MetaWhatsAppBlockedError rather
// than inventing a payload shape. Everything else (webhook verification,
// send, webhook normalization) uses Graph API primitives stable enough
// across Meta's platforms (Messenger/Instagram/WhatsApp all share the same
// webhook signing scheme) that they were safe to implement and verify.

export class MetaWhatsAppBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaWhatsAppBlockedError";
  }
}

export interface MetaWhatsAppConfig {
  /** The Shinã platform's own Meta App secret — used ONLY to verify
   *  inbound webhook signatures (X-Hub-Signature-256). One value for the
   *  whole platform; never per-tenant. */
  appSecret: string;
  /** The string configured in the Meta App Dashboard's webhook
   *  subscription "Verify Token" field — checked against hub.verify_token
   *  on the GET handshake. */
  webhookVerifyToken: string;
  /** Graph API version, e.g. "v26.0" — confirmed current as of the docs
   *  fetch that informed this file, but Meta revs this regularly; keep it
   *  configurable, never hardcode a version forever (spec section 38). */
  graphApiVersion: string;
  /** Resolves the per-tenant-channel access token needed to call the Graph
   *  API on behalf of that specific WABA/phone number. Injected rather
   *  than read from a single env var — WhatsApp is genuinely multi-tenant,
   *  so there is no one platform-wide send credential (unlike appSecret).
   *  Backed by messaging_channel_credentials (see that table's own
   *  migration comment re: encryption-at-rest gap). */
  getAccessToken: (messagingChannelId: string) => Promise<string>;
  graphApiBaseUrl?: string;
}

interface MetaSendResponse {
  messages?: Array<{ id: string }>;
}

export class MetaWhatsAppProvider implements MessagingProvider {
  readonly type = "whatsapp" as const;

  constructor(private readonly config: MetaWhatsAppConfig) {}

  private graphBase(): string {
    return (
      this.config.graphApiBaseUrl ?? `https://graph.facebook.com/${this.config.graphApiVersion}`
    );
  }

  /**
   * BLOCKED — see class-level comment. Embedded Signup's authorization-code
   * -> system-user-token -> WABA/phone-number-ID exchange is Meta-app-
   * specific and cannot be safely invented without a registered app to
   * test against. Do not implement this by guessing the payload shape;
   * wire it once META_APP_ID/META_APP_SECRET and a reviewed Facebook Login
   * for Business config exist, consulting Meta's current Embedded Signup
   * documentation at that time.
   */
  async connectAccount(): Promise<ChannelConnectionResult> {
    throw new MetaWhatsAppBlockedError(
      "Embedded Signup is not implemented — no registered Meta App is configured for this " +
        "environment. Connect a WhatsApp number manually (store the WABA/phone number IDs and " +
        "access token obtained through Meta Business Suite directly) until Embedded Signup is wired.",
    );
  }

  /**
   * Confirmed: GET /{version}/{phone-number-id} with fields=... returns
   * the number's verified_name/quality_rating/etc, authenticated via
   * Authorization: Bearer {token}. Status here maps only what this
   * platform's MessagingChannelStatus actually models — Meta's own
   * verification/quality states are richer and are NOT modeled 1:1 (spec
   * section 8: canonical events, not provider vocabulary, leak into the
   * domain).
   */
  async getChannelStatus(channel: MessagingChannel): Promise<ChannelStatusResult> {
    if (!channel.externalPhoneNumberId) return { status: "error" };
    const token = await this.config.getAccessToken(channel.id);
    const res = await fetch(`${this.graphBase()}/${channel.externalPhoneNumberId}?fields=id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: res.ok ? "connected" : "error" };
  }

  /**
   * Confirmed: POST /{version}/{phone-number-id}/messages,
   * Authorization: Bearer {token}, body
   * {messaging_product:"whatsapp", recipient_type:"individual", to, type:"text", text:{body}},
   * response {messages:[{id:"wamid...."}]}.
   */
  async sendText(input: SendTextInput): Promise<ProviderSendResult> {
    return this.send(input.channel, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.toExternalId,
      type: "text",
      text: { body: input.body },
    });
  }

  /** Confirmed: template message body needs name/language.code/components. */
  async sendTemplate(input: SendTemplateInput): Promise<ProviderSendResult> {
    return this.send(input.channel, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.toExternalId,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components: input.components,
      },
    });
  }

  /**
   * NOT independently verified against current docs beyond the general
   * message envelope shape (messaging_product/to/type) — media messages
   * require a prior media upload to get a media `id`, which this method
   * does not perform (mediaRef here is assumed to already be a Meta media
   * id, resolved elsewhere). Flagged rather than guessed further.
   */
  async sendMedia(input: SendMediaInput): Promise<ProviderSendResult> {
    return this.send(input.channel, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.toExternalId,
      type: input.type,
      [input.type]: { id: input.mediaRef, caption: input.caption },
    });
  }

  async markAsRead(channel: MessagingChannel, providerMessageId: string): Promise<void> {
    if (!channel.externalPhoneNumberId) return;
    const token = await this.config.getAccessToken(channel.id);
    await fetch(`${this.graphBase()}/${channel.externalPhoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: providerMessageId,
      }),
    });
  }

  private async send(
    channel: MessagingChannel,
    body: Record<string, unknown>,
  ): Promise<ProviderSendResult> {
    if (!channel.externalPhoneNumberId) {
      throw new Error(`messaging channel ${channel.id} has no externalPhoneNumberId`);
    }
    const token = await this.config.getAccessToken(channel.id);
    const res = await fetch(`${this.graphBase()}/${channel.externalPhoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`WhatsApp send failed (${res.status}): ${detail}`);
    }
    const json = (await res.json()) as MetaSendResponse;
    const id = json.messages?.[0]?.id;
    if (!id) throw new Error("WhatsApp send response missing messages[0].id");
    return { providerMessageId: id };
  }

  /**
   * Confirmed: Meta signs every webhook POST body with HMAC-SHA256 using
   * the App Secret, delivered in the `X-Hub-Signature-256` header as
   * `sha256={hex digest}`. Verification MUST use the raw, unparsed request
   * body — computing the digest over a JSON.parse()'d-and-restringified
   * body can produce a different byte sequence than what Meta actually
   * signed (whitespace/key-order differences), a documented lesson already
   * learned the hard way in this codebase's own signature-platform.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string | null>): boolean {
    const header = headers["x-hub-signature-256"] ?? headers["X-Hub-Signature-256"];
    if (!header || !header.startsWith("sha256=")) return false;
    const expected = header.slice("sha256=".length);
    const digest = createHmac("sha256", this.config.appSecret)
      .update(rawBody, "utf8")
      .digest("hex");
    if (expected.length !== digest.length) return false;
    try {
      return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(digest, "hex"));
    } catch {
      return false;
    }
  }

  /**
   * Confirmed shape: entry[].changes[].value carries
   * {messaging_product, metadata:{phone_number_id}, contacts:[{wa_id, profile:{name}}],
   *  messages:[{from, id, timestamp, type, text:{body}}], statuses:[{id, status, recipient_id}]}.
   * `status` values sent/delivered/read are confirmed from docs; `failed`
   * is a very well-established WhatsApp status but was not itself quoted
   * back by the fetched page — mapped defensively (an unrecognized status
   * string falls through to "failed" rather than silently dropping the
   * event, since a silently-ignored terminal status is worse than an
   * over-eager one here).
   */
  async normalizeWebhook(
    rawBody: string,
    headers: Record<string, string | null>,
  ): Promise<CanonicalMessagingEvent[]> {
    if (!this.verifyWebhook(rawBody, headers)) return [];

    const parsed = JSON.parse(rawBody) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            metadata?: { phone_number_id?: string };
            contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
            messages?: Array<{
              from?: string;
              id?: string;
              timestamp?: string;
              type?: string;
              text?: { body?: string };
            }>;
            statuses?: Array<{ id?: string; status?: string; recipient_id?: string }>;
          };
        }>;
      }>;
    };

    const events: CanonicalMessagingEvent[] = [];

    for (const entry of parsed.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        for (const msg of value.messages ?? []) {
          if (!msg.id || !msg.from) continue;
          const contact = value.contacts?.find((c) => c.wa_id === msg.from);
          const inbound: CanonicalInboundMessage = {
            externalConversationKey: msg.from,
            externalSenderId: msg.from,
            externalSenderName: contact?.profile?.name ?? null,
            providerMessageId: msg.id,
            type: mapInboundType(msg.type),
            body: msg.text?.body ?? null,
            mediaRef: null,
            occurredAt: msg.timestamp
              ? new Date(Number(msg.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
            raw: msg as Record<string, unknown>,
          };
          events.push({
            provider: "whatsapp",
            providerEventId: msg.id,
            eventType: "messages",
            kind: "message_received",
            externalPhoneNumberId: phoneNumberId,
            inboundMessage: inbound,
            rawPayload: msg as Record<string, unknown>,
          });
        }

        for (const status of value.statuses ?? []) {
          if (!status.id) continue;
          const update: CanonicalStatusUpdate = {
            providerMessageId: status.id,
            status: mapStatus(status.status),
            occurredAt: new Date().toISOString(),
          };
          events.push({
            provider: "whatsapp",
            providerEventId: `${status.id}:${status.status ?? "unknown"}`,
            eventType: "statuses",
            kind: statusToKind(update.status),
            externalPhoneNumberId: phoneNumberId,
            statusUpdate: update,
            rawPayload: status as Record<string, unknown>,
          });
        }
      }
    }

    return events;
  }

  verifyWebhookSubscription(query: Record<string, string | null>): string | null {
    if (
      query["hub.mode"] === "subscribe" &&
      query["hub.verify_token"] === this.config.webhookVerifyToken
    ) {
      return query["hub.challenge"] ?? null;
    }
    return null;
  }

  async disconnect(): Promise<void> {
    // Deauthorizing a Meta-connected number is part of the Embedded Signup
    // lifecycle this provider doesn't implement yet (connectAccount() is
    // blocked) — nothing to call here until that exists.
  }
}

function mapInboundType(rawType: string | undefined): MessageType {
  switch (rawType) {
    case "text":
    case "image":
    case "video":
    case "audio":
    case "document":
    case "location":
    case "contacts":
      return rawType === "contacts" ? "contact" : rawType;
    case "interactive":
      return "interactive";
    default:
      return "system";
  }
}

function mapStatus(rawStatus: string | undefined): MessageStatus {
  switch (rawStatus) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    default:
      return "failed";
  }
}

function statusToKind(status: MessageStatus): CanonicalMessagingEvent["kind"] {
  switch (status) {
    case "sent":
      return "message_sent";
    case "delivered":
      return "message_delivered";
    case "read":
      return "message_read";
    default:
      return "message_failed";
  }
}
