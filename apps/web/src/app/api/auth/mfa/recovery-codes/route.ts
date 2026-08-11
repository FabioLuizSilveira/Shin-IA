import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashRecoveryCode } from "@/lib/auth/mfa-recovery-hash";

export const dynamic = "force-dynamic";

const RECOVERY_CODE_COUNT = 8;
// Excludes 0/O/1/I — ambiguous when handwritten/read back from a screen.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

// POST /api/auth/mfa/recovery-codes — (re)generates the one-time backup
// codes for the user's most recent active TOTP enrollment. Called right
// after /api/auth/mfa/enroll during setup; plain codes are only ever
// returned here, never persisted — the table stores just the HMAC hash
// (see lib/auth/mfa-recovery-hash.ts).
export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id, tenant_id")
    .eq("auth_user_id", user.id)
    .single();
  if (profileError || !profile) {
    return internalError(profileError ?? new Error("user_profiles row not found"));
  }

  const { data: enrollment, error: enrollmentError } = await admin
    .from("mfa_enrollments")
    .select("id")
    .eq("user_id", profile.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (enrollmentError) {
    return internalError(enrollmentError);
  }
  if (!enrollment) {
    return NextResponse.json({ error: "No active MFA enrollment found" }, { status: 422 });
  }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateCode);
  const rows = await Promise.all(
    codes.map(async (code) => ({
      tenant_id: profile.tenant_id,
      user_id: profile.id,
      mfa_enrollment_id: enrollment.id,
      code: await hashRecoveryCode(code),
    })),
  );

  const { error: insertError } = await admin.from("mfa_recovery_codes").insert(rows);
  if (insertError) {
    return internalError(insertError);
  }

  await admin.from("mfa_enrollments").update({ backup_enabled: true }).eq("id", enrollment.id);

  return NextResponse.json({ codes });
}
