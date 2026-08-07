import { NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase/server";
import { MFA_COOKIE_NAME, MFA_COOKIE_TTL_SECONDS, signMfaCookie } from "@/lib/auth/mfa-cookie";

export const dynamic = "force-dynamic";

// POST /api/auth/mfa/confirm — issue the signed mfa_verified cookie.
// Only succeeds when the current session actually reached aal2, which
// Supabase grants after a successful TOTP verify. This keeps the check
// server-side: the client cannot fabricate the cookie.
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    return internalError(error);
  }
  if (aal?.currentLevel !== "aal2") {
    return NextResponse.json({ error: "MFA not verified for this session" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(MFA_COOKIE_NAME, await signMfaCookie(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MFA_COOKIE_TTL_SECONDS,
  });
  return response;
}
