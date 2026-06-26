import type { NotificationChannelType } from "./types.js";

export interface DispatchPayload {
  channelType: NotificationChannelType;
  recipientAddress: string;
  subject: string | null;
  body: string;
  metadata: Record<string, unknown>;
}

export interface DispatchResult {
  success: boolean;
  error?: string;
  externalId?: string;
}

/**
 * Channel dispatcher interface — concrete implementations (SMTP, Twilio, FCM,
 * etc.) are injected at runtime. This package only defines the abstraction.
 */
export interface ChannelDispatcher {
  readonly channelType: NotificationChannelType;
  dispatch(payload: DispatchPayload): Promise<DispatchResult>;
}

export class DispatcherRegistry {
  private dispatchers = new Map<NotificationChannelType, ChannelDispatcher>();

  register(dispatcher: ChannelDispatcher): void {
    this.dispatchers.set(dispatcher.channelType, dispatcher);
  }

  get(channelType: NotificationChannelType): ChannelDispatcher {
    const d = this.dispatchers.get(channelType);
    if (!d) throw new Error(`no dispatcher registered for channel: ${channelType}`);
    return d;
  }

  has(channelType: NotificationChannelType): boolean {
    return this.dispatchers.has(channelType);
  }

  list(): NotificationChannelType[] {
    return [...this.dispatchers.keys()];
  }
}

// ─── No-op stubs (used in tests and dry-run mode) ────────────────────────────

export class NoOpEmailDispatcher implements ChannelDispatcher {
  readonly channelType: NotificationChannelType = "email";
  async dispatch(_payload: DispatchPayload): Promise<DispatchResult> {
    return { success: true, externalId: crypto.randomUUID() };
  }
}

export class NoOpSmsDispatcher implements ChannelDispatcher {
  readonly channelType: NotificationChannelType = "sms";
  async dispatch(_payload: DispatchPayload): Promise<DispatchResult> {
    return { success: true, externalId: crypto.randomUUID() };
  }
}

export class NoOpPushDispatcher implements ChannelDispatcher {
  readonly channelType: NotificationChannelType = "push";
  async dispatch(_payload: DispatchPayload): Promise<DispatchResult> {
    return { success: true, externalId: crypto.randomUUID() };
  }
}

export class NoOpInAppDispatcher implements ChannelDispatcher {
  readonly channelType: NotificationChannelType = "in_app";
  async dispatch(_payload: DispatchPayload): Promise<DispatchResult> {
    return { success: true, externalId: crypto.randomUUID() };
  }
}

export class NoOpWebhookDispatcher implements ChannelDispatcher {
  readonly channelType: NotificationChannelType = "webhook";
  async dispatch(_payload: DispatchPayload): Promise<DispatchResult> {
    return { success: true, externalId: crypto.randomUUID() };
  }
}
