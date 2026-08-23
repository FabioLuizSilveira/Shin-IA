import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identityProvider } from "@/lib/identity";
import { verifyTotpCode } from "@/lib/auth/totp";
import { decryptTotpSecret } from "@/lib/auth/mfa-crypto";

export const dynamic = "force-dynamic";

// POST /api/auth/mfa/native/enroll/confirm — proves the user actually
// scanned/entered the secret into a real authenticator app before it
// becomes usable for step-up. Never trusts a client-supplied "it worked" —
// the code is re-verified server-side against the stored (encrypted)
// secret.
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

  if (!credential || credential.status !== "pending") {
    return NextResponse.json({ error: "No pending enrollment to confirm" }, { status: 409 });
  }

  const secret = await decryptTotpSecret(credential.encrypted_secret);
  const ok = await verifyTotpCode(secret, code);
  if (!ok) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  const { error } = await admin
    .from("shina_totp_credentials")
    .update({ status: "active", verified_at: new Date().toISOString() })
    .eq("shina_user_id", session.identity.uid);
  if (error) return NextResponse.json({ error: "Failed to confirm enrollment" }, { status: 500 });

  return NextResponse.json({ data: { ok: true } });
}
