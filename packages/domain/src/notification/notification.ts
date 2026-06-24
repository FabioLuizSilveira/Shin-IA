import { AggregateRoot } from "../shared/aggregate-root.js";
import { DomainError } from "../shared/domain-error.js";
import type { TenantId } from "../tenant/tenant.js";
import { NotificationChannel } from "./notification-channel.enum.js";
import { NotificationPriority } from "./notification-priority.enum.js";
import { NotificationStatus } from "./notification-status.enum.js";
import { createEvent } from "../shared/create-event.js";

export type NotificationId = string & { readonly __brand: "NotificationId" };

export interface CreateNotificationProps {
  id: NotificationId;
  tenantId: TenantId;
  recipientId: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  subject: string;
  body: string;
}

interface NotificationState {
  tenantId: TenantId;
  recipientId: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  subject: string;
  body: string;
  status: NotificationStatus;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Notification extends AggregateRoot<NotificationId> {
  private _state: NotificationState;

  private constructor(id: NotificationId, state: NotificationState) {
    super(id);
    this._state = state;
  }

  static create(props: CreateNotificationProps): Notification {
    if (!props.subject.trim())
      throw new DomainError("NOTIFICATION_SUBJECT_REQUIRED", "Notification subject is required.");

    const now = new Date();
    const notification = new Notification(props.id, {
      ...props,
      status: NotificationStatus.Pending,
      sentAt: null,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    });

    notification.raise(
      createEvent("notification.created", props.id, "Notification", props.tenantId, {
        channel: props.channel,
        recipientId: props.recipientId,
      }),
    );

    return notification;
  }

  get tenantId(): TenantId {
    return this._state.tenantId;
  }
  get recipientId(): string {
    return this._state.recipientId;
  }
  get channel(): NotificationChannel {
    return this._state.channel;
  }
  get priority(): NotificationPriority {
    return this._state.priority;
  }
  get subject(): string {
    return this._state.subject;
  }
  get body(): string {
    return this._state.body;
  }
  get status(): NotificationStatus {
    return this._state.status;
  }
  get sentAt(): Date | null {
    return this._state.sentAt;
  }
  get readAt(): Date | null {
    return this._state.readAt;
  }

  markSent(): void {
    if (this._state.status !== NotificationStatus.Pending)
      throw new DomainError(
        "NOTIFICATION_NOT_PENDING",
        "Only pending notifications can be marked sent.",
      );
    this._state.status = NotificationStatus.Sent;
    this._state.sentAt = new Date();
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("notification.sent", this._id, "Notification", this._state.tenantId, {}),
    );
  }

  markRead(): void {
    if (this._state.status === NotificationStatus.Read)
      throw new DomainError("NOTIFICATION_ALREADY_READ", "Notification is already read.");
    this._state.status = NotificationStatus.Read;
    this._state.readAt = new Date();
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("notification.read", this._id, "Notification", this._state.tenantId, {}),
    );
  }

  fail(reason: string): void {
    this._state.status = NotificationStatus.Failed;
    this._state.updatedAt = new Date();
    this.raise(
      createEvent("notification.failed", this._id, "Notification", this._state.tenantId, {
        reason,
      }),
    );
  }
}
