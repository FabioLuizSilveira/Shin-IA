import type {
  NotificationChannel,
  NotificationChannelRepository,
  NotificationChannelType,
  NotificationHistoryRepository,
  NotificationPreferencesRepository,
  NotificationQueueRepository,
  NotificationTemplateRepository,
} from "./types.js";
import { TemplateEngine } from "./template-engine.js";
import { DispatcherRegistry } from "./dispatcher.js";

export interface EnqueueRequest {
  tenantId: string;
  channelType: NotificationChannelType;
  recipientId: string;
  recipientAddress: string;
  templateName?: string;
  templateContext?: Record<string, unknown>;
  subject?: string;
  body?: string;
  metadata?: Record<string, unknown>;
  scheduledAt?: string;
  maxAttempts?: number;
}

export interface EnqueueResult {
  queueId: string;
  status: "pending" | "skipped";
  reason?: string;
}

export interface ProcessResult {
  queueId: string;
  success: boolean;
  attempts: number;
  error?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [60_000, 300_000, 900_000] as const;

export class NotificationRuntime {
  constructor(
    private channels: NotificationChannelRepository,
    private templates: NotificationTemplateRepository,
    private queue: NotificationQueueRepository,
    private preferences: NotificationPreferencesRepository,
    private history: NotificationHistoryRepository,
    private templateEngine: TemplateEngine,
    private dispatcherRegistry: DispatcherRegistry,
  ) {}

  async enqueue(request: EnqueueRequest): Promise<EnqueueResult> {
    // Check preferences
    const prefs = await this.preferences.findByRecipient(request.tenantId, request.recipientId);
    if (prefs && prefs.channels[request.channelType] === false) {
      return {
        queueId: "",
        status: "skipped",
        reason: "recipient has disabled this channel",
      };
    }

    // Resolve channel
    const activeChannels = await this.channels.findActiveByType(
      request.tenantId,
      request.channelType,
    );
    const channel = activeChannels[0];
    if (!channel) {
      throw new Error(`no active channel of type ${request.channelType} for tenant`);
    }

    // Resolve content
    const { subject, body, templateId } = await this.resolveContent(request, channel);

    const now = new Date().toISOString();
    const item = await this.queue.save({
      id: crypto.randomUUID(),
      tenantId: request.tenantId,
      channelId: channel.id,
      templateId,
      recipientId: request.recipientId,
      recipientAddress: request.recipientAddress,
      subject,
      body,
      metadata: request.metadata ?? {},
      status: "pending",
      attempts: 0,
      maxAttempts: request.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      nextRetryAt: request.scheduledAt ?? null,
      scheduledAt: request.scheduledAt ?? null,
      sentAt: null,
      failedAt: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });

    return { queueId: item.id, status: "pending" };
  }

  async process(queueId: string): Promise<ProcessResult> {
    const item = await this.queue.findById(queueId);
    if (!item) throw new Error(`queue item ${queueId} not found`);

    if (item.status === "sent" || item.status === "cancelled") {
      return { queueId, success: true, attempts: item.attempts };
    }

    const channel = await this.channels.findById(item.channelId);
    if (!channel) throw new Error(`channel ${item.channelId} not found`);

    const now = new Date().toISOString();
    const attempts = item.attempts + 1;

    try {
      const dispatcher = this.dispatcherRegistry.get(channel.type);
      const result = await dispatcher.dispatch({
        channelType: channel.type,
        recipientAddress: item.recipientAddress,
        subject: item.subject,
        body: item.body,
        metadata: item.metadata,
      });

      if (!result.success) throw new Error(result.error ?? "dispatch failed");

      await this.queue.update({
        ...item,
        status: "sent",
        attempts,
        sentAt: now,
        updatedAt: now,
      });

      await this.history.save({
        id: crypto.randomUUID(),
        tenantId: item.tenantId,
        queueId: item.id,
        channelType: channel.type,
        recipientId: item.recipientId,
        recipientAddress: item.recipientAddress,
        subject: item.subject,
        body: item.body,
        status: "sent",
        attempts,
        error: null,
        sentAt: now,
        createdAt: now,
      });

      return { queueId, success: true, attempts };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const failed = attempts >= item.maxAttempts;
      const nextRetryAt = failed
        ? null
        : new Date(Date.now() + (RETRY_DELAY_MS[attempts - 1] ?? RETRY_DELAY_MS[2])).toISOString();

      await this.queue.update({
        ...item,
        status: failed ? "failed" : "pending",
        attempts,
        nextRetryAt,
        failedAt: failed ? now : item.failedAt,
        error,
        updatedAt: now,
      });

      if (failed) {
        await this.history.save({
          id: crypto.randomUUID(),
          tenantId: item.tenantId,
          queueId: item.id,
          channelType: channel.type,
          recipientId: item.recipientId,
          recipientAddress: item.recipientAddress,
          subject: item.subject,
          body: item.body,
          status: "failed",
          attempts,
          error,
          sentAt: null,
          createdAt: now,
        });
      }

      return { queueId, success: false, attempts, error };
    }
  }

  async processBatch(limit = 50): Promise<ProcessResult[]> {
    const pending = await this.queue.findPending(limit);
    const results: ProcessResult[] = [];
    for (const item of pending) {
      results.push(await this.process(item.id));
    }
    return results;
  }

  getDispatcherRegistry(): DispatcherRegistry {
    return this.dispatcherRegistry;
  }

  private async resolveContent(
    request: EnqueueRequest,
    _channel: NotificationChannel,
  ): Promise<{ subject: string | null; body: string; templateId: string | null }> {
    if (request.templateName) {
      const template = await this.templates.findByName(request.tenantId, request.templateName);
      if (!template) {
        throw new Error(`template "${request.templateName}" not found`);
      }
      const rendered = this.templateEngine.render(template, request.templateContext ?? {});
      return { subject: rendered.subject, body: rendered.body, templateId: template.id };
    }

    if (!request.body) {
      throw new Error("either templateName or body must be provided");
    }

    return {
      subject: request.subject ?? null,
      body: request.body,
      templateId: null,
    };
  }
}
