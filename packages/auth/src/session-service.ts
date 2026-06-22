// Session Service - User session management
// Tracks active sessions, handles session lifecycle

import type { Session, SessionMetadata } from "./types.js";
import type { AuthEventEmitter } from "./events/index.js";

export interface SessionServiceDeps {
  sessionDurationMinutes?: number;
  inactivityTimeoutMinutes?: number;
  maxConcurrentSessions?: number;
  eventEmitter: AuthEventEmitter;
}

export class SessionService {
  private sessionDurationMinutes: number;
  private inactivityTimeoutMinutes: number;
  private maxConcurrentSessions: number;
  private eventEmitter: AuthEventEmitter;

  constructor(deps: SessionServiceDeps) {
    this.sessionDurationMinutes = deps.sessionDurationMinutes || 480; // 8 hours
    this.inactivityTimeoutMinutes = deps.inactivityTimeoutMinutes || 120; // 2 hours
    this.maxConcurrentSessions = deps.maxConcurrentSessions || 3;
    this.eventEmitter = deps.eventEmitter;
  }

  // Create a new session
  createSession(
    userId: string,
    tenantId: string,
    authSessionId: string,
    metadata?: SessionMetadata,
  ): Session {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionDurationMinutes * 60_000);

    return {
      id: crypto.randomUUID(),
      userId,
      tenantId,
      authSessionId,
      status: "active",
      mfaVerified: false,
      mfaVerifiedAt: null,
      mfaMethod: null,
      isImpersonated: false,
      impersonationId: null,
      ipAddress: metadata?.ipAddress || null,
      userAgent: metadata?.userAgent || null,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
    };
  }

  // Check if session is expired
  isSessionExpired(session: Session): boolean {
    if (session.status === "expired" || session.status === "revoked") {
      return true;
    }

    const now = new Date();

    // Check if session has reached absolute expiry
    if (now > session.expiresAt) {
      return true;
    }

    // Check if session has been inactive too long
    const inactivityMs = now.getTime() - session.lastActivityAt.getTime();
    if (inactivityMs > this.inactivityTimeoutMinutes * 60_000) {
      return true;
    }

    return false;
  }

  // Update session activity timestamp
  updateSessionActivity(session: Session): Session {
    return {
      ...session,
      lastActivityAt: new Date(),
    };
  }

  // Mark session as MFA verified
  markMFAVerified(session: Session, mfaMethod: string): Session {
    return {
      ...session,
      mfaVerified: true,
      mfaVerifiedAt: new Date(),
      mfaMethod: mfaMethod as any,
    };
  }

  // Revoke session
  revokeSession(session: Session): Session {
    return {
      ...session,
      status: "revoked",
    };
  }

  // Expire session (due to timeout)
  expireSession(session: Session): Session {
    return {
      ...session,
      status: "expired",
    };
  }

  // Emit session created event
  async emitSessionCreated(
    tenantId: string,
    userId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.eventEmitter.emit({
      eventType: "auth.session.created",
      tenantId,
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: {},
      occurredAt: new Date(),
    });
  }

  // Emit session expired event
  async emitSessionExpired(tenantId: string, sessionId: string): Promise<void> {
    await this.eventEmitter.emit({
      eventType: "auth.session.expired",
      tenantId,
      sessionId,
      metadata: {},
      occurredAt: new Date(),
    });
  }

  // Emit logout event
  async emitLogout(
    tenantId: string,
    userId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.eventEmitter.emit({
      eventType: "auth.logout",
      tenantId,
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: {},
      occurredAt: new Date(),
    });
  }

  // Get session duration in minutes
  getSessionDurationMinutes(): number {
    return this.sessionDurationMinutes;
  }

  // Get inactivity timeout in minutes
  getInactivityTimeoutMinutes(): number {
    return this.inactivityTimeoutMinutes;
  }

  // Get max concurrent sessions
  getMaxConcurrentSessions(): number {
    return this.maxConcurrentSessions;
  }
}
