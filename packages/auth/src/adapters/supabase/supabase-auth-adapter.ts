// Supabase Auth Adapter
// Integrates AuthService with Supabase Auth

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthError,
  AuthUser,
  LoginRequest,
  LoginResponse,
  SessionMetadata,
} from "../../types.js";
import { AUTH_ERRORS } from "../../types.js";
import { AuthService } from "../../auth-service.js";
import type { AuthEventEmitter } from "../../events/index.js";

export interface SupabaseAuthAdapterConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
  eventEmitter: AuthEventEmitter;
}

export class SupabaseAuthAdapter {
  private supabase: SupabaseClient;
  private authService: AuthService;
  private eventEmitter: AuthEventEmitter;

  constructor(config: SupabaseAuthAdapterConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    this.authService = new AuthService({
      eventEmitter: config.eventEmitter,
    });
    this.eventEmitter = config.eventEmitter;
  }

  // Login with email and password
  async login(
    request: LoginRequest,
    metadata?: SessionMetadata,
  ): Promise<LoginResponse | AuthError> {
    try {
      // Authenticate via Supabase Auth
      const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
        email: request.email,
        password: request.password,
      });

      if (authError || !authData.session || !authData.user) {
        await this.eventEmitter.emit({
          eventType: "auth.login.failed",
          tenantId: "unknown", // Will be resolved from JWT later
          metadata: {
            email: request.email,
            reason: authError?.message || "Authentication failed",
            attempt: 1,
          },
          occurredAt: new Date(),
        });
        return AUTH_ERRORS.INVALID_CREDENTIALS;
      }

      const supabaseUser = authData.user;
      const sessionToken = authData.session.access_token;

      // Decode JWT to get tenant_id and roles
      // In production, this would be in the JWT from Supabase
      const jwtClaims = this.parseJWT(sessionToken);
      if (!jwtClaims.tenant_id) {
        return AUTH_ERRORS.TENANT_NOT_FOUND;
      }

      // Get user profile from database
      const userProfile = await this.getUserProfile(supabaseUser.id, jwtClaims.tenant_id);
      if (!userProfile) {
        return AUTH_ERRORS.USER_NOT_FOUND;
      }

      // Check if user is suspended
      if (userProfile.status === "suspended") {
        return AUTH_ERRORS.USER_SUSPENDED;
      }

      // Create session in database
      const sessionService = this.authService.getSessionService();
      const session = sessionService.createSession(
        userProfile.id,
        jwtClaims.tenant_id,
        authData.session.access_token,
        metadata,
      );

      // Save session to database
      await this.saveSession(session);

      // Build response with user data
      const authUser: AuthUser = {
        id: userProfile.id,
        email: userProfile.email,
        fullName: userProfile.full_name,
        phoneNumber: userProfile.phone_number,
        avatarUrl: userProfile.avatar_url,
        mfaRequired: userProfile.mfa_required,
        mfaMethod: userProfile.mfa_method,
        status: userProfile.status,
        lastLoginAt: userProfile.last_login_at ? new Date(userProfile.last_login_at) : null,
        createdAt: new Date(userProfile.created_at),
        updatedAt: new Date(userProfile.updated_at),
      };

      // Emit login event
      await this.eventEmitter.emit({
        eventType: "auth.login",
        tenantId: jwtClaims.tenant_id,
        userId: userProfile.id,
        sessionId: session.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        metadata: { email: request.email },
        occurredAt: new Date(),
      });

      // Emit session created event
      await sessionService.emitSessionCreated(
        jwtClaims.tenant_id,
        userProfile.id,
        session.id,
        metadata?.ipAddress,
        metadata?.userAgent,
      );

      // Return login response
      const response: LoginResponse = {
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token || "",
        user: authUser,
        session,
        mfaRequired: userProfile.mfa_required,
        mfaMethod: userProfile.mfa_method || undefined,
      };

      return response;
    } catch (error) {
      console.error("Login error:", error);
      return AUTH_ERRORS.INVALID_CREDENTIALS;
    }
  }

  // Logout - revoke session
  async logout(
    sessionId: string,
    userId: string,
    tenantId: string,
    metadata?: SessionMetadata,
  ): Promise<void> {
    try {
      // Sign out from Supabase
      await this.supabase.auth.signOut();

      // Mark session as revoked in database
      await this.revokeSession(sessionId);

      // Emit logout event
      const sessionService = this.authService.getSessionService();
      await sessionService.emitLogout(
        tenantId,
        userId,
        sessionId,
        metadata?.ipAddress,
        metadata?.userAgent,
      );
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  // Refresh access token
  async refreshSession(
    refreshToken: string,
    _metadata?: SessionMetadata,
  ): Promise<{ accessToken: string } | AuthError> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        return AUTH_ERRORS.SESSION_EXPIRED;
      }

      return {
        accessToken: data.session.access_token,
      };
    } catch (error) {
      console.error("Refresh session error:", error);
      return AUTH_ERRORS.SESSION_EXPIRED;
    }
  }

  // Request password reset
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.PUBLIC_URL}/auth/reset-password`,
      });

      await this.eventEmitter.emit({
        eventType: "auth.password.reset",
        tenantId: "unknown",
        metadata: { email },
        occurredAt: new Date(),
      });
    } catch (error) {
      console.error("Password reset request error:", error);
    }
  }

  // Confirm password reset
  async confirmPasswordReset(token: string, newPassword: string): Promise<AuthError | void> {
    try {
      const { data, error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error || !data.user) {
        return {
          code: "PASSWORD_RESET_FAILED",
          message: "Failed to reset password",
          statusCode: 400,
        };
      }

      // Get tenant from user
      const jwtClaims = this.parseJWT(token);
      await this.eventEmitter.emit({
        eventType: "auth.password.reset.completed",
        tenantId: jwtClaims.tenant_id || "unknown",
        userId: data.user.id,
        metadata: { email: data.user.email },
        occurredAt: new Date(),
      });
    } catch (error) {
      console.error("Password reset confirmation error:", error);
      return {
        code: "PASSWORD_RESET_FAILED",
        message: "Failed to reset password",
        statusCode: 400,
      };
    }
  }

  // Verify email
  async verifyEmail(token: string): Promise<AuthError | void> {
    try {
      const { data, error } = await this.supabase.auth.verifyOtp({
        token_hash: token,
        type: "email",
      });

      if (error || !data.user) {
        return {
          code: "EMAIL_VERIFICATION_FAILED",
          message: "Failed to verify email",
          statusCode: 400,
        };
      }

      // Get tenant from user
      const jwtClaims = this.parseJWT(token);
      await this.eventEmitter.emit({
        eventType: "auth.email.verified",
        tenantId: jwtClaims.tenant_id || "unknown",
        userId: data.user.id,
        metadata: { email: data.user.email },
        occurredAt: new Date(),
      });
    } catch (error) {
      console.error("Email verification error:", error);
      return {
        code: "EMAIL_VERIFICATION_FAILED",
        message: "Failed to verify email",
        statusCode: 400,
      };
    }
  }

  // Get current authenticated user
  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        return null;
      }

      // Get tenant from session
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      if (!session) {
        return null;
      }

      const jwtClaims = this.parseJWT(session.access_token);
      if (!jwtClaims.tenant_id) {
        return null;
      }

      // Get profile from database
      const profile = await this.getUserProfile(user.id, jwtClaims.tenant_id);
      if (!profile) {
        return null;
      }

      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        phoneNumber: profile.phone_number,
        avatarUrl: profile.avatar_url,
        mfaRequired: profile.mfa_required,
        mfaMethod: profile.mfa_method,
        status: profile.status,
        lastLoginAt: profile.last_login_at ? new Date(profile.last_login_at) : null,
        createdAt: new Date(profile.created_at),
        updatedAt: new Date(profile.updated_at),
      };
    } catch (error) {
      console.error("Get current user error:", error);
      return null;
    }
  }

  // Private helpers

  private parseJWT(token: string): Record<string, any> {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return {};
      }

      const payload = parts[1];
      const decoded = Buffer.from(payload, "base64").toString("utf-8");
      return JSON.parse(decoded);
    } catch {
      return {};
    }
  }

  private async getUserProfile(authUserId: string, tenantId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from("user_profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .eq("tenant_id", tenantId)
        .single();

      if (error) {
        console.error("Get user profile error:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Get user profile error:", error);
      return null;
    }
  }

  private async saveSession(session: any): Promise<void> {
    try {
      const { error } = await this.supabase.from("user_sessions").insert({
        id: session.id,
        tenant_id: session.tenantId,
        user_id: session.userId,
        auth_session_id: session.authSessionId,
        ip_address: session.ipAddress,
        user_agent: session.userAgent,
        status: session.status,
        mfa_verified: session.mfaVerified,
        is_impersonated: session.isImpersonated,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
        expires_at: session.expiresAt,
        last_activity_at: session.lastActivityAt,
      });

      if (error) {
        console.error("Save session error:", error);
      }
    } catch (error) {
      console.error("Save session error:", error);
    }
  }

  private async revokeSession(sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("user_sessions")
        .update({ status: "revoked" })
        .eq("id", sessionId);

      if (error) {
        console.error("Revoke session error:", error);
      }
    } catch (error) {
      console.error("Revoke session error:", error);
    }
  }

  // Expose Supabase client for advanced usage
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  // Expose auth service
  getAuthService(): AuthService {
    return this.authService;
  }
}
