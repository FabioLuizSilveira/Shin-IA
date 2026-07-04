import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MFA_COOKIE_NAME, MFA_COOKIE_TTL_SECONDS, signMfaCookie } from "@/lib/auth/mfa-cookie";

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
  const codeHash = Buffer.from(body.code.trim().toUpperCase()).toString("base64");

  const { data: record, error: findError } = await admin
    .from("mfa_recovery_codes")
    .select("id")
    .eq("user_id", user.id)
    .eq("code_hash", codeHash)
    .eq("used", false)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
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
