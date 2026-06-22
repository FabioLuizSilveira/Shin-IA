// Auth Service - Main authentication service
// Coordinates login, logout, password reset, and session management
// Does NOT implement authorization (RBAC/ABAC) - that comes in later milestones

import type { AuthEventEmitter } from "./events/index.js";
import type {
  AuthError,
  AuthUser,
  JWTClaims,
  LoginRequest,
  LoginResponse,
  SessionMetadata,
} from "./types.js";
import { MFAService } from "./mfa-service.js";
import { SessionService } from "./session-service.js";
import { TenantContextResolver } from "./tenant-context.js";

export interface AuthServiceDeps {
  eventEmitter: AuthEventEmitter;
  sessionDurationMinutes?: number;
  inactivityTimeoutMinutes?: number;
  maxConcurrentSessions?: number;
  maxLoginAttempts?: number;
  lockoutDurationMinutes?: number;
}

export class AuthService {
  private sessionService: SessionService;
  private mfaService: MFAService;
  private tenantContextResolver: TenantContextResolver;
  // TODO: Use in M4.1 implementation
  // private eventEmitter: AuthEventEmitter;
  // private maxLoginAttempts: number;
  // private lockoutDurationMinutes: number;

  constructor(deps: AuthServiceDeps) {
    this.sessionService = new SessionService({
      sessionDurationMinutes: deps.sessionDurationMinutes,
      inactivityTimeoutMinutes: deps.inactivityTimeoutMinutes,
      maxConcurrentSessions: deps.maxConcurrentSessions,
      eventEmitter: deps.eventEmitter,
    });
    this.mfaService = new MFAService({ eventEmitter: deps.eventEmitter });
    this.tenantContextResolver = new TenantContextResolver();
    // TODO: Use in M4.1 implementation
    // this.maxLoginAttempts = deps.maxLoginAttempts || 5;
    // this.lockoutDurationMinutes = deps.lockoutDurationMinutes || 15;
  }

  // Note: Login implementation requires Supabase Auth integration
  // This is the skeleton - actual implementation in auth adapter
  async login(
    _request: LoginRequest,
    _metadata?: SessionMetadata,
  ): Promise<LoginResponse | AuthError> {
    // TODO: Integrate with Supabase Auth
    // 1. Verify credentials via Supabase Auth
    // 2. Check user status (active, suspended, etc.)
    // 3. Check login attempts and lockout
    // 4. Create session
    // 5. Generate JWT claims
    // 6. Emit login event
    // 7. Return access token and user
    throw new Error("Not implemented - requires Supabase Auth integration");
  }

  // Logout - revoke session
  async logout(
    _sessionId: string,
    _userId: string,
    _tenantId: string,
    _metadata?: SessionMetadata,
  ): Promise<void> {
    // TODO: Implement logout
    // 1. Find session
    // 2. Revoke session
    // 3. Emit logout event
    // 4. Clean up Supabase auth session
  }

  // Refresh session/access token
  async refreshSession(
    _refreshToken: string,
    _metadata?: SessionMetadata,
  ): Promise<{ accessToken: string }> {
    // TODO: Implement refresh
    // 1. Validate refresh token via Supabase Auth
    // 2. Generate new access token with updated claims
    // 3. Return new token
    throw new Error("Not implemented - requires Supabase Auth integration");
  }

  // Request password reset
  async requestPasswordReset(_email: string): Promise<void> {
    // TODO: Implement password reset request
    // 1. Find user by email
    // 2. Generate reset token
    // 3. Send reset email
    // 4. Emit password reset event
  }

  // Confirm password reset
  async confirmPasswordReset(_token: string, _newPassword: string): Promise<void> {
    // TODO: Implement password reset confirmation
    // 1. Validate reset token
    // 2. Update password via Supabase Auth
    // 3. Emit password reset completed event
  }

  // Verify email
  async verifyEmail(_token: string): Promise<void> {
    // TODO: Implement email verification
    // 1. Validate email verification token
    // 2. Mark email as verified
    // 3. Emit email verified event
  }

  // Get current user from token
  getCurrentUser(_token: string): AuthUser {
    // TODO: Extract user from JWT token
    // 1. Verify and decode JWT
    // 2. Get user from database
    // 3. Return user
    throw new Error("Not implemented");
  }

  // Get services for dependency injection
  getSessionService(): SessionService {
    return this.sessionService;
  }

  getMFAService(): MFAService {
    return this.mfaService;
  }

  getTenantContextResolver(): TenantContextResolver {
    return this.tenantContextResolver;
  }

  // Helper: Build JWT claims (structure for later use)
  buildJWTClaims(
    userId: string,
    email: string,
    tenantId: string,
    platformRole?: string,
    tenantRole?: string,
    branchIds: string[] = [],
    capabilities: string[] = [],
    expiresInSeconds: number = 3600,
  ): JWTClaims {
    const now = Math.floor(Date.now() / 1000);
    return {
      sub: userId,
      email,
      email_verified: true,
      tenant_id: tenantId,
      platform_role: platformRole,
      tenant_role: tenantRole,
      branch_ids: branchIds,
      capabilities,
      iat: now,
      exp: now + expiresInSeconds,
    };
  }

  // Helper: Validate JWT claims structure
  validateJWTClaims(claims: unknown): claims is JWTClaims {
    const c = claims as JWTClaims;
    return (
      typeof c.sub === "string" &&
      typeof c.email === "string" &&
      typeof c.tenant_id === "string" &&
      typeof c.iat === "number" &&
      typeof c.exp === "number"
    );
  }
}
