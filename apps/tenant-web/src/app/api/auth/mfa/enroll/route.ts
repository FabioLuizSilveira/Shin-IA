import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/auth/mfa/enroll — record MFA enrollment in our DB
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

  const admin = createAdminClient();

  // Upsert enrollment record
  const { error } = await admin.from("mfa_enrollments").upsert(
    {
      user_id: user.id,
      method: body.method ?? "totp",
      status: "verified",
      factor_id: body.factorId,
      enrolled_at: new Date().toISOString(),
    },
    { onConflict: "user_id,method" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET /api/auth/mfa/enroll — check enrollment status
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("mfa_enrollments")
    .select("status, method, enrolled_at")
    .eq("user_id", user.id)
    .eq("status", "verified")
    .maybeSingle();

  return NextResponse.json({ enrolled: !!data, enrollment: data });
}
