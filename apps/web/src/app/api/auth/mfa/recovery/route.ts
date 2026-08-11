import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MFA_COOKIE_NAME, MFA_COOKIE_TTL_SECONDS, signMfaCookie } from "@/lib/auth/mfa-cookie";
import { hashRecoveryCode } from "@/lib/auth/mfa-recovery-hash";

export const dynamic = "force-dynamic";

// POST /api/auth/mfa/recovery — validate and consume a recovery code.
// On success the signed mfa_verified cookie is set server-side (httpOnly).
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.code) {
    return NextResponse.json({ error: "code is required" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (profileError || !profile) {
    return internalError(profileError ?? new Error("user_profiles row not found"));
  }

  const codeHash = await hashRecoveryCode(body.code);

  // Security fix: this used to query a "code_hash" column that has never
  // existed on mfa_recovery_codes (the real column is "code") and compared
  // against auth.users.id instead of user_profiles.id — every redemption
  // attempt failed with a Postgres "column does not exist" error. Fixed to
  // match the actual schema (see migrations/20260025000000_mfa_recovery_codes.sql).
  const { data: record, error: findError } = await admin
    .from("mfa_recovery_codes")
    .select("id")
    .eq("user_id", profile.id)
    .eq("code", codeHash)
    .eq("used", false)
    .maybeSingle();

  if (findError) {
    return internalError(findError);
  }

  if (!record) {
    return NextResponse.json({ error: "Invalid or already used recovery code" }, { status: 400 });
  }

  await admin
    .from("mfa_recovery_codes")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", record.id);

  const response = NextResponse.json({ valid: true });
  response.cookies.set(MFA_COOKIE_NAME, await signMfaCookie(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MFA_COOKIE_TTL_SECONDS,
  });
  return response;
}
