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

export class SupabaseEmailDispatcher implements ChannelDispatcher {
  readonly channelType: NotificationChannelType = "email";

  constructor(
    private supabaseUrl: string,
    private supabaseServiceKey: string,
  ) {}

  async dispatch(payload: DispatchPayload): Promise<DispatchResult> {
    try {
      const baseUrl = this.supabaseUrl.replace(/\/$/, "");
      const url = `${baseUrl}/functions/v1/send-email`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.supabaseServiceKey}`,
        },
        body: JSON.stringify({
          to: payload.recipientAddress,
          template: payload.metadata?.template ?? "welcome",
          data: payload.metadata?.data ?? {
            subject: payload.subject ?? "",
            body: payload.body,
          },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          error: `Supabase edge function HTTP error ${res.status}: ${errorText}`,
        };
      }

      const json = (await res.json()) as { id?: string; error?: string };
      if (json.error) {
        return { success: false, error: json.error };
      }

      return { success: true, externalId: json.id ?? "dev-mode-no-send" };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
