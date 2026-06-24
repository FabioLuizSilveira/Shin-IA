// ─── Channel ──────────────────────────────────────────────────────────────────

export type NotificationChannelType = "email" | "sms" | "push" | "in_app" | "webhook";

export interface NotificationChannel {
  id: string;
  tenantId: string;
  type: NotificationChannelType;
  name: string;
  config: Record<string, unknown>;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

// ─── Template ─────────────────────────────────────────────────────────────────

export interface NotificationTemplate {
  id: string;
  tenantId: string;
  name: string;
  channelType: NotificationChannelType;
  subject: string | null;
  body: string;
  variables: string[];
  locale: string;
  status: "active" | "inactive" | "draft";
  createdAt: string;
  updatedAt: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export type NotificationStatus = "pending" | "processing" | "sent" | "failed" | "cancelled";

export interface NotificationQueue {
  id: string;
  tenantId: string;
  channelId: string;
  templateId: string | null;
  recipientId: string;
  recipientAddress: string;
  subject: string | null;
  body: string;
  metadata: Record<string, unknown>;
  status: NotificationStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Preferences ─────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  id: string;
  tenantId: string;
  recipientId: string;
  channels: Partial<Record<NotificationChannelType, boolean>>;
  quiet: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    timezone: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface NotificationHistory {
  id: string;
  tenantId: string;
  queueId: string;
  channelType: NotificationChannelType;
  recipientId: string;
  recipientAddress: string;
  subject: string | null;
  body: string;
  status: "sent" | "failed";
  attempts: number;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

// ─── Repository interfaces ────────────────────────────────────────────────────

export interface NotificationChannelRepository {
  findById(id: string): Promise<NotificationChannel | null>;
  findByTenantId(tenantId: string): Promise<NotificationChannel[]>;
  findActiveByType(tenantId: string, type: NotificationChannelType): Promise<NotificationChannel[]>;
  save(channel: NotificationChannel): Promise<NotificationChannel>;
  update(channel: NotificationChannel): Promise<NotificationChannel>;
}

export interface NotificationTemplateRepository {
  findById(id: string): Promise<NotificationTemplate | null>;
  findByTenantId(tenantId: string): Promise<NotificationTemplate[]>;
  findByName(tenantId: string, name: string): Promise<NotificationTemplate | null>;
  save(template: NotificationTemplate): Promise<NotificationTemplate>;
  update(template: NotificationTemplate): Promise<NotificationTemplate>;
}

export interface NotificationQueueRepository {
  findById(id: string): Promise<NotificationQueue | null>;
  findPending(limit: number): Promise<NotificationQueue[]>;
  findByRecipient(tenantId: string, recipientId: string): Promise<NotificationQueue[]>;
  save(item: NotificationQueue): Promise<NotificationQueue>;
  update(item: NotificationQueue): Promise<NotificationQueue>;
}

export interface NotificationPreferencesRepository {
  findByRecipient(tenantId: string, recipientId: string): Promise<NotificationPreferences | null>;
  save(prefs: NotificationPreferences): Promise<NotificationPreferences>;
  update(prefs: NotificationPreferences): Promise<NotificationPreferences>;
}

export interface NotificationHistoryRepository {
  findByRecipient(tenantId: string, recipientId: string): Promise<NotificationHistory[]>;
  findByQueueId(queueId: string): Promise<NotificationHistory[]>;
  save(history: NotificationHistory): Promise<NotificationHistory>;
}
