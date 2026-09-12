import { randomUUID } from "crypto";
import type {
  CanonicalMessagingEvent,
  ChannelConnectionResult,
  ChannelStatusResult,
  MessagingChannel,
  MessagingProvider,
  ProviderSendResult,
  SendMediaInput,
  SendTemplateInput,
  SendTextInput,
} from "../types.js";

// FakeMessagingProvider — NOT a real gateway. Exists purely so the
// mandatory substitutability/isolation tests (and any future test) can
// exercise the whole MessagingProvider contract without a Meta sandbox
// account, same posture as @shina/signature-platform's own FakeProvider.
// Deliberately in-memory and synchronous-ish; every method still returns a
// Promise to match the real interface shape.
export class FakeMessagingProvider implements MessagingProvider {
  readonly type = "fake" as const;

  sentMessages: Array<{ kind: string; to: string; body?: string }> = [];
  private nextInboundQueue: CanonicalMessagingEvent[] = [];

  /** Test hook: queue a canonical event that the next normalizeWebhook()
   *  call (regardless of what's actually passed in) will return. */
  queueInboundEvent(event: CanonicalMessagingEvent): void {
    this.nextInboundQueue.push(event);
  }

  async connectAccount(): Promise<ChannelConnectionResult> {
    return {
      externalBusinessAccountId: `fake-waba-${randomUUID()}`,
      externalPhoneNumberId: `fake-phone-${randomUUID()}`,
      externalAccountId: null,
      displayPhoneNumber: "+55 11 90000-0000",
      displayName: "Fake WhatsApp Sandbox",
    };
  }

  async getChannelStatus(_channel: MessagingChannel): Promise<ChannelStatusResult> {
    return { status: "connected" };
  }

  async sendText(input: SendTextInput): Promise<ProviderSendResult> {
    this.sentMessages.push({ kind: "text", to: input.toExternalId, body: input.body });
    return { providerMessageId: `fake-msg-${randomUUID()}` };
  }

  async sendTemplate(input: SendTemplateInput): Promise<ProviderSendResult> {
    this.sentMessages.push({ kind: "template", to: input.toExternalId });
    return { providerMessageId: `fake-msg-${randomUUID()}` };
  }

  async sendMedia(input: SendMediaInput): Promise<ProviderSendResult> {
    this.sentMessages.push({ kind: "media", to: input.toExternalId });
    return { providerMessageId: `fake-msg-${randomUUID()}` };
  }

  async markAsRead(): Promise<void> {
    // no-op
  }

  verifyWebhook(): boolean {
    return true;
  }

  async normalizeWebhook(): Promise<CanonicalMessagingEvent[]> {
    const queued = this.nextInboundQueue;
    this.nextInboundQueue = [];
    return queued;
  }

  verifyWebhookSubscription(query: Record<string, string | null>): string | null {
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === "fake-verify-token") {
      return query["hub.challenge"] ?? null;
    }
    return null;
  }

  async disconnect(): Promise<void> {
    // no-op
  }
}
