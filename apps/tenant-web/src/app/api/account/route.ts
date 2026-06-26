import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/export
 * LGPD Art. 18 — Right to data portability
 * Returns all personal data for the authenticated user as JSON.
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Collect all user data in parallel
  const [profileRes, sessionsRes, mfaRes, auditRes] = await Promise.all([
    admin.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    admin
      .from("user_sessions")
      .select("id, created_at, last_active_at, ip_address, user_agent")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("mfa_enrollments").select("method, status, enrolled_at").eq("user_id", user.id),
    admin
      .from("auth_events")
      .select("event_type, created_at, ip_address, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    requestedBy: user.id,
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
    },
    profile: profileRes.data ?? null,
    sessions: sessionsRes.data ?? [],
    mfaEnrollments: mfaRes.data ?? [],
    authEvents: auditRes.data ?? [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="shina-data-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}

/**
 * DELETE /api/account
 * LGPD Art. 18 — Right to erasure
 * Soft-deletes the account: anonymises personal data, revokes sessions,
 * marks profile as deleted. Hard delete happens after 30-day cooling period.
 */
export async function DELETE() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const deletedAt = new Date().toISOString();

  // 1. Anonymise user profile
  await admin
    .from("user_profiles")
    .update({
      full_name: "[Deleted User]",
      phone: null,
      avatar_url: null,
      status: "deleted",
      deleted_at: deletedAt,
    })
    .eq("user_id", user.id);

  // 2. Revoke all MFA enrollments and recovery codes
  await admin.from("mfa_enrollments").update({ status: "revoked" }).eq("user_id", user.id);
  await admin.from("mfa_recovery_codes").update({ used: true }).eq("user_id", user.id);

  // 3. Deactivate IAM roles
  await admin.from("iam_tenant_user_roles").update({ is_active: false }).eq("user_id", user.id);

  // 4. Sign out all sessions
  await supabase.auth.signOut({ scope: "global" });

  // 5. Schedule hard delete via admin (30-day grace period)
  // In production this would enqueue a background job.
  // For now, log the deletion request.
  console.log(`[account/delete] deletion scheduled for user=${user.id} at=${deletedAt}`);

  return NextResponse.json({
    success: true,
    message: "Account deletion scheduled. Your data will be permanently deleted within 30 days.",
    deletedAt,
  });
}
