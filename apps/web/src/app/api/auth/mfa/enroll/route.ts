import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/auth/mfa/enroll — records a TOTP factor (already verified
// client-side via supabase.auth.mfa.verify()) against our own IAM tables,
// which the tenant/studio access-control UI reads from — Supabase's own
// auth.mfa_factors table isn't queryable from the app.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { factorId?: string; method?: string };
  try {
    body = (await req.json()) as { factorId?: string; method?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.factorId) {
    return NextResponse.json({ error: "factorId is required" }, { status: 422 });
  }
  const method = body.method === "totp" ? "totp" : null;
  if (!method) {
    return NextResponse.json({ error: "Unsupported method" }, { status: 422 });
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

  const { data: enrollment, error: insertError } = await admin
    .from("mfa_enrollments")
    .insert({
      tenant_id: profile.tenant_id,
      user_id: profile.id,
      method,
      credential: body.factorId,
      status: "active",
      is_primary: true,
      verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError) {
    return internalError(insertError);
  }

  return NextResponse.json({ data: { enrollmentId: enrollment.id } });
}
