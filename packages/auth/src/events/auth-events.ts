// Authentication domain events

export type AuthEventType =
  | "auth.login"
  | "auth.logout"
  | "auth.session.created"
  | "auth.session.expired"
  | "auth.session.revoked"
  | "auth.password.reset"
  | "auth.password.reset.completed"
  | "auth.email.verified"
  | "auth.email.verification.sent"
  | "auth.mfa.enrolled"
  | "auth.mfa.verified"
  | "auth.mfa.failed"
  | "auth.login.failed";

export type AuthEvent = {
  eventType: AuthEventType;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, unknown>;
  occurredAt: Date;
};

export type AuthLoginEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.login";
  userId: string;
  sessionId: string;
};

export type AuthLogoutEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.logout";
  userId: string;
  sessionId: string;
};

export type AuthSessionCreatedEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.session.created";
  userId: string;
  sessionId: string;
};

export type AuthSessionExpiredEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.session.expired";
  sessionId: string;
};

export type AuthMFAEnrolledEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.mfa.enrolled";
  userId: string;
  mfaMethod: string;
};

export type AuthMFAVerifiedEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.mfa.verified";
  userId: string;
  sessionId: string;
  mfaMethod: string;
};

export type AuthMFAFailedEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.mfa.failed";
  userId?: string;
  sessionId?: string;
  mfaMethod: string;
  attempt: number;
};

export type AuthLoginFailedEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.login.failed";
  email: string;
  reason: string;
  attempt: number;
};

export type AuthPasswordResetEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.password.reset";
  email: string;
};

export type AuthPasswordResetCompletedEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.password.reset.completed";
  userId: string;
};

export type AuthEmailVerifiedEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.email.verified";
  userId: string;
  email: string;
};

export type AuthEmailVerificationSentEvent = Omit<AuthEvent, "eventType"> & {
  eventType: "auth.email.verification.sent";
  email: string;
};

export interface AuthEventEmitter {
  emit(event: AuthEvent): Promise<void>;
}
