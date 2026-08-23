import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identityProvider } from "@/lib/identity";
import { verifyTotpCode } from "@/lib/auth/totp";
import { decryptTotpSecret } from "@/lib/auth/mfa-crypto";
import {
  STEPUP_COOKIE_NAME,
  STEPUP_COOKIE_TTL_SECONDS,
  signStepUpCookie,
} from "@/lib/auth/stepup-cookie";

export const dynamic = "force-dynamic";

// POST /api/auth/mfa/native/challenge — verifies a TOTP code against the
// caller's active credential and, on success, issues the short-lived
// step-up cookie a sensitive route can require via requireStepUp()
// (lib/auth/require-step-up.ts). Not wired to any route yet this round —
// foundation only, per this round's explicit scope decision.
export async function POST(req: NextRequest) {
  const session = await identityProvider.getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = (await req.json()) as { code?: string };
  if (typeof code !== "string") {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: credential } = await admin
    .from("shina_totp_credentials")
    .select("encrypted_secret, status")
    .eq("shina_user_id", session.identity.uid)
    .maybeSingle();

  if (!credential || credential.status !== "active") {
    return NextResponse.json({ error: "No active TOTP credential" }, { status: 409 });
  }

  const secret = await decryptTotpSecret(credential.encrypted_secret);
  const ok = await verifyTotpCode(secret, code);
  if (!ok) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  await admin
    .from("shina_totp_credentials")
    .update({ last_used_at: new Date().toISOString() })
    .eq("shina_user_id", session.identity.uid);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STEPUP_COOKIE_NAME, await signStepUpCookie(session.identity.uid), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STEPUP_COOKIE_TTL_SECONDS,
  });
  return response;
}
