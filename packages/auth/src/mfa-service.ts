// MFA Service - Multi-factor authentication management
// Handles TOTP enrollment, verification, and recovery codes

import * as speakeasy from "speakeasy";

import type { MFAMethod, MFARecoveryCode } from "./types.js";
import type { AuthEventEmitter } from "./events/index.js";

export interface MFAServiceDeps {
  eventEmitter: AuthEventEmitter;
}

export class MFAService {
  private eventEmitter: AuthEventEmitter;

  constructor(deps: MFAServiceDeps) {
    this.eventEmitter = deps.eventEmitter;
  }

  // Generate TOTP secret and QR code
  generateTOTPSecret(email: string): {
    secret: string;
    qrCode: string;
  } {
    const secret = speakeasy.generateSecret({
      name: `Shinã Platform (${email})`,
      issuer: "Shinã Platform",
      length: 32,
    });

    if (!secret.base32 || !secret.otpauth_url) {
      throw new Error("Failed to generate TOTP secret");
    }

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url,
    };
  }

  // Verify TOTP code
  verifyTOTPCode(secret: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: code,
      window: 2, // Allow 30 seconds before and after
    });
  }

  // Generate recovery codes (one-time use backup codes)
  generateRecoveryCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = Array.from({ length: 8 })
        .map(() => {
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          return chars.charAt(Math.floor(Math.random() * chars.length));
        })
        .join("");
      codes.push(code);
    }
    return codes;
  }

  // Verify recovery code (mark as used)
  // In production, codes should be hashed
  verifyRecoveryCode(codes: MFARecoveryCode[], providedCode: string): MFARecoveryCode | null {
    const code = codes.find((c) => !c.used && c.code === providedCode.toUpperCase());
    return code || null;
  }

  // Emit MFA enrolled event
  async emitMFAEnrolled(
    tenantId: string,
    userId: string,
    mfaMethod: MFAMethod,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.eventEmitter.emit({
      eventType: "auth.mfa.enrolled",
      tenantId,
      userId,
      ipAddress,
      userAgent,
      metadata: { mfaMethod },
      occurredAt: new Date(),
    });
  }

  // Emit MFA verified event
  async emitMFAVerified(
    tenantId: string,
    userId: string,
    sessionId: string,
    mfaMethod: MFAMethod,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.eventEmitter.emit({
      eventType: "auth.mfa.verified",
      tenantId,
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: { mfaMethod },
      occurredAt: new Date(),
    });
  }

  // Emit MFA failed event
  async emitMFAFailed(
    tenantId: string,
    mfaMethod: MFAMethod,
    attempt: number,
    ipAddress?: string,
    userAgent?: string,
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    await this.eventEmitter.emit({
      eventType: "auth.mfa.failed",
      tenantId,
      userId,
      sessionId,
      ipAddress,
      userAgent,
      metadata: { mfaMethod, attempt },
      occurredAt: new Date(),
    });
  }
}
