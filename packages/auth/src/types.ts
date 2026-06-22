// Authentication types

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  mfaRequired: boolean;
  mfaMethod: MFAMethod | null;
  status: "active" | "inactive" | "suspended";
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MFAMethod = "totp" | "sms" | "email" | "webauthn";

export type Session = {
  id: string;
  userId: string;
  tenantId: string;
  authSessionId: string;
  status: "active" | "expired" | "revoked";
  mfaVerified: boolean;
  mfaVerifiedAt: Date | null;
  mfaMethod: MFAMethod | null;
  isImpersonated: boolean;
  impersonationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
};

export type SessionMetadata = {
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
};

export type JWTClaims = {
  sub: string; // auth user id
  email: string;
  email_verified: boolean;
  tenant_id: string;
  platform_role?: string;
  tenant_role?: string;
  branch_ids?: string[];
  capabilities?: string[];
  mfa_verified?: boolean;
  iat: number;
  exp: number;
};

export type MFAEnrollment = {
  id: string;
  userId: string;
  method: MFAMethod;
  credential: string;
  status: "active" | "inactive" | "pending";
  isPrimary: boolean;
  backupEnabled: boolean;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MFARecoveryCode = {
  id: string;
  code: string;
  used: boolean;
  usedAt: Date | null;
};

export type TenantContext = {
  tenantId: string;
  userId: string;
  platformRole?: string;
  tenantRole?: string;
  branchIds: string[];
  capabilities: string[];
};

export type LoginRequest = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  session: Session;
  mfaRequired?: boolean;
  mfaMethod?: MFAMethod;
};

export type ResetPasswordRequest = {
  email: string;
};

export type ResetPasswordConfirm = {
  token: string;
  newPassword: string;
};

export type MFASetupResponse = {
  secret: string;
  qrCode: string;
  backupCodes: string[];
};

export type MFAVerifyRequest = {
  code: string;
  method: MFAMethod;
};

export type AuthError = {
  code: string;
  message: string;
  statusCode: number;
};

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: "INVALID_CREDENTIALS",
    message: "Invalid email or password",
    statusCode: 401,
  } as AuthError,
  USER_NOT_FOUND: {
    code: "USER_NOT_FOUND",
    message: "User not found",
    statusCode: 404,
  } as AuthError,
  USER_SUSPENDED: {
    code: "USER_SUSPENDED",
    message: "User account is suspended",
    statusCode: 403,
  } as AuthError,
  MFA_REQUIRED: {
    code: "MFA_REQUIRED",
    message: "MFA verification required",
    statusCode: 403,
  } as AuthError,
  INVALID_MFA_CODE: {
    code: "INVALID_MFA_CODE",
    message: "Invalid MFA code",
    statusCode: 401,
  } as AuthError,
  SESSION_EXPIRED: {
    code: "SESSION_EXPIRED",
    message: "Session has expired",
    statusCode: 401,
  } as AuthError,
  TENANT_NOT_FOUND: {
    code: "TENANT_NOT_FOUND",
    message: "Tenant not found",
    statusCode: 404,
  } as AuthError,
} as const;
