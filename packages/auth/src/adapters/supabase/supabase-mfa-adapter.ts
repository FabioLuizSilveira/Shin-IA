// Supabase MFA Adapter
// Integrates MFAService with Supabase database

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { MFAEnrollment, MFAMethod, MFARecoveryCode } from "../../types.js";
import { MFAService } from "../../mfa-service.js";
import type { AuthEventEmitter } from "../../events/index.js";

export interface SupabaseMFAAdapterConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  eventEmitter: AuthEventEmitter;
}

export class SupabaseMFAAdapter {
  private supabase: SupabaseClient;
  private mfaService: MFAService;

  constructor(config: SupabaseMFAAdapterConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    this.mfaService = new MFAService({ eventEmitter: config.eventEmitter });
  }

  // Setup TOTP MFA enrollment
  async setupTOTPEnrollment(
    userId: string,
    tenantId: string,
    email: string,
  ): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  }> {
    // Generate TOTP secret and recovery codes
    const totpSetup = this.mfaService.generateTOTPSecret(email);
    const recoveryCodes = this.mfaService.generateRecoveryCodes(10);

    // Store enrollment in database as pending
    const { data: enrollment, error: enrollmentError } = await this.supabase
      .from("mfa_enrollments")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        method: "totp",
        credential: totpSetup.secret,
        status: "pending",
        is_primary: false,
        backup_enabled: false,
      })
      .select()
      .single();

    if (enrollmentError || !enrollment) {
      throw new Error(`Failed to create MFA enrollment: ${enrollmentError?.message}`);
    }

    // Store recovery codes as pending
    for (const code of recoveryCodes) {
      await this.supabase.from("mfa_recovery_codes").insert({
        tenant_id: tenantId,
        user_id: userId,
        mfa_enrollment_id: enrollment.id,
        code: code, // In production, hash this
        used: false,
      });
    }

    return {
      secret: totpSetup.secret,
      qrCode: totpSetup.qrCode,
      backupCodes: recoveryCodes,
    };
  }

  // Verify TOTP code and complete enrollment
  async completeTOTPEnrollment(
    userId: string,
    tenantId: string,
    enrollmentId: string,
    totpCode: string,
  ): Promise<boolean> {
    // Get pending enrollment
    const { data: enrollment, error: fetchError } = await this.supabase
      .from("mfa_enrollments")
      .select("*")
      .eq("id", enrollmentId)
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .single();

    if (fetchError || !enrollment) {
      throw new Error("Enrollment not found or already verified");
    }

    // Verify TOTP code
    const isValid = this.mfaService.verifyTOTPCode(enrollment.credential, totpCode);
    if (!isValid) {
      return false;
    }

    // Mark enrollment as active
    const { error: updateError } = await this.supabase
      .from("mfa_enrollments")
      .update({
        status: "active",
        verified_at: new Date().toISOString(),
        is_primary: true, // Make first enrollment primary
      })
      .eq("id", enrollmentId);

    if (updateError) {
      throw new Error(`Failed to verify enrollment: ${updateError.message}`);
    }

    // Emit MFA enrolled event
    await this.mfaService.emitMFAEnrolled(tenantId, userId, "totp");

    return true;
  }

  // Verify TOTP code for login
  async verifyTOTPCode(userId: string, tenantId: string, totpCode: string): Promise<boolean> {
    // Get active TOTP enrollment
    const { data: enrollment, error } = await this.supabase
      .from("mfa_enrollments")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("method", "totp")
      .eq("status", "active")
      .eq("is_primary", true)
      .single();

    if (error || !enrollment) {
      throw new Error("TOTP enrollment not found");
    }

    // Verify code
    const isValid = this.mfaService.verifyTOTPCode(enrollment.credential, totpCode);

    if (isValid) {
      // Update last used
      await this.supabase
        .from("mfa_enrollments")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", enrollment.id);
    }

    return isValid;
  }

  // Get recovery codes for user
  async getRecoveryCodes(
    userId: string,
    tenantId: string,
    enrollmentId: string,
  ): Promise<MFARecoveryCode[]> {
    const { data: codes, error } = await this.supabase
      .from("mfa_recovery_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("mfa_enrollment_id", enrollmentId);

    if (error) {
      throw new Error(`Failed to get recovery codes: ${error.message}`);
    }

    return codes.map((code) => ({
      id: code.id,
      code: code.code,
      used: code.used,
      usedAt: code.used_at ? new Date(code.used_at) : null,
    }));
  }

  // Use recovery code
  async useRecoveryCode(
    userId: string,
    tenantId: string,
    providedCode: string,
    sessionId: string,
  ): Promise<boolean> {
    // Get all recovery codes
    const { data: codes, error: fetchError } = await this.supabase
      .from("mfa_recovery_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("used", false);

    if (fetchError || !codes) {
      return false;
    }

    // Find matching code
    const mfaCodes: MFARecoveryCode[] = codes.map((code) => ({
      id: code.id,
      code: code.code,
      used: code.used,
      usedAt: code.used_at ? new Date(code.used_at) : null,
    }));

    const matchedCode = this.mfaService.verifyRecoveryCode(mfaCodes, providedCode);
    if (!matchedCode) {
      return false;
    }

    // Mark code as used
    const { error: updateError } = await this.supabase
      .from("mfa_recovery_codes")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_session_id: sessionId,
      })
      .eq("id", matchedCode.id);

    if (updateError) {
      return false;
    }

    return true;
  }

  // Get active MFA enrollment
  async getActiveMFAEnrollment(userId: string, tenantId: string): Promise<MFAEnrollment | null> {
    const { data: enrollment, error } = await this.supabase
      .from("mfa_enrollments")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .eq("is_primary", true)
      .single();

    if (error || !enrollment) {
      return null;
    }

    return {
      id: enrollment.id,
      userId: enrollment.user_id,
      method: enrollment.method as MFAMethod,
      credential: enrollment.credential,
      status: enrollment.status,
      isPrimary: enrollment.is_primary,
      backupEnabled: enrollment.backup_enabled,
      verifiedAt: enrollment.verified_at ? new Date(enrollment.verified_at) : null,
      lastUsedAt: enrollment.last_used_at ? new Date(enrollment.last_used_at) : null,
      createdAt: new Date(enrollment.created_at),
      updatedAt: new Date(enrollment.updated_at),
    };
  }

  // Disable MFA
  async disableMFA(userId: string, tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from("mfa_enrollments")
      .update({ status: "inactive" })
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (error) {
      throw new Error(`Failed to disable MFA: ${error.message}`);
    }
  }

  // Get MFA service
  getMFAService(): MFAService {
    return this.mfaService;
  }
}
