// Supabase Session Adapter
// Manages session persistence in Supabase database

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Session } from "../../types.js";
import { SessionService } from "../../session-service.js";
import type { AuthEventEmitter } from "../../events/index.js";

export interface SupabaseSessionAdapterConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  eventEmitter: AuthEventEmitter;
  sessionDurationMinutes?: number;
  inactivityTimeoutMinutes?: number;
  maxConcurrentSessions?: number;
}

export class SupabaseSessionAdapter {
  private supabase: SupabaseClient;
  private sessionService: SessionService;

  constructor(config: SupabaseSessionAdapterConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    this.sessionService = new SessionService({
      sessionDurationMinutes: config.sessionDurationMinutes,
      inactivityTimeoutMinutes: config.inactivityTimeoutMinutes,
      maxConcurrentSessions: config.maxConcurrentSessions,
      eventEmitter: config.eventEmitter,
    });
  }

  // Get session by ID
  async getSessionById(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.supabase
      .from("user_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapRowToSession(data);
  }

  // Get active sessions for user
  async getActiveSessions(userId: string, tenantId: string): Promise<Session[]> {
    const { data, error } = await this.supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => this.mapRowToSession(row));
  }

  // Check if session is expired and mark if needed
  async validateSession(sessionId: string): Promise<Session | null> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      return null;
    }

    const isExpired = this.sessionService.isSessionExpired(session);
    if (isExpired && session.status === "active") {
      // Mark as expired
      await this.updateSessionStatus(sessionId, "expired");
      return { ...session, status: "expired" };
    }

    // Update last activity
    await this.supabase
      .from("user_sessions")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", sessionId);

    return session;
  }

  // Mark session as MFA verified
  async markSessionMFAVerified(sessionId: string, mfaMethod: string): Promise<void> {
    const { error } = await this.supabase
      .from("user_sessions")
      .update({
        mfa_verified: true,
        mfa_verified_at: new Date().toISOString(),
        mfa_method: mfaMethod,
      })
      .eq("id", sessionId);

    if (error) {
      throw new Error(`Failed to mark session as MFA verified: ${error.message}`);
    }
  }

  // Revoke session
  async revokeSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from("user_sessions")
      .update({ status: "revoked" })
      .eq("id", sessionId);

    if (error) {
      throw new Error(`Failed to revoke session: ${error.message}`);
    }
  }

  // Expire session (due to timeout)
  async expireSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from("user_sessions")
      .update({ status: "expired" })
      .eq("id", sessionId);

    if (error) {
      throw new Error(`Failed to expire session: ${error.message}`);
    }
  }

  // Revoke all sessions for user
  async revokeAllUserSessions(userId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from("user_sessions")
      .update({ status: "revoked" })
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (error) {
      throw new Error(`Failed to revoke all sessions: ${error.message}`);
    }
  }

  // Enforce max concurrent sessions
  async enforceMaxConcurrentSessions(userId: string, tenantId: string): Promise<void> {
    const maxSessions = this.sessionService.getMaxConcurrentSessions();
    const activeSessions = await this.getActiveSessions(userId, tenantId);

    if (activeSessions.length > maxSessions) {
      // Revoke oldest sessions
      const sessionsToRevoke = activeSessions.slice(maxSessions);
      for (const session of sessionsToRevoke) {
        await this.revokeSession(session.id);
      }
    }
  }

  // Clean up expired sessions (batch operation)
  async cleanupExpiredSessions(): Promise<number> {
    const { data: expiredSessions, error: fetchError } = await this.supabase
      .from("user_sessions")
      .select("id")
      .eq("status", "active")
      .lt("expires_at", new Date().toISOString());

    if (fetchError || !expiredSessions) {
      return 0;
    }

    if (expiredSessions.length === 0) {
      return 0;
    }

    const sessionIds = expiredSessions.map((s) => s.id);
    const { error: updateError } = await this.supabase
      .from("user_sessions")
      .update({ status: "expired" })
      .in("id", sessionIds);

    if (updateError) {
      console.error("Cleanup error:", updateError);
      return 0;
    }

    return sessionIds.length;
  }

  // Get session service
  getSessionService(): SessionService {
    return this.sessionService;
  }

  // Private helpers

  private async updateSessionStatus(
    sessionId: string,
    status: "active" | "expired" | "revoked",
  ): Promise<void> {
    await this.supabase.from("user_sessions").update({ status }).eq("id", sessionId);
  }

  private mapRowToSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      authSessionId: row.auth_session_id,
      status: row.status,
      mfaVerified: row.mfa_verified,
      mfaVerifiedAt: row.mfa_verified_at ? new Date(row.mfa_verified_at) : null,
      mfaMethod: row.mfa_method,
      isImpersonated: row.is_impersonated,
      impersonationId: row.impersonation_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      lastActivityAt: new Date(row.last_activity_at),
    };
  }
}
