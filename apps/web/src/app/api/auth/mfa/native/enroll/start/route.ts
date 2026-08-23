import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { identityProvider } from "@/lib/identity";
import { generateTotpSecret, buildTotpUri } from "@/lib/auth/totp";
import { encryptTotpSecret } from "@/lib/auth/mfa-crypto";

export const dynamic = "force-dynamic";

// POST /api/auth/mfa/native/enroll/start — generates a fresh TOTP secret
// and stores it as "pending" (not yet usable for step-up — enroll/confirm
// must verify a real code from it first). Re-calling this while a pending
// enrollment already exists replaces it — an abandoned attempt (never
// scanned/confirmed) is safe to discard, same reasoning the old Supabase
// MFA setup page used for orphaned unverified factors.
export async function POST() {
  const session = await identityProvider.getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = generateTotpSecret();
  const encrypted = await encryptTotpSecret(secret);
  const admin = createAdminClient();

  const { error } = await admin.from("shina_totp_credentials").upsert(
    {
      shina_user_id: session.identity.uid,
      encrypted_secret: encrypted,
      status: "pending",
      verified_at: null,
    },
    { onConflict: "shina_user_id" },
  );
  if (error) return NextResponse.json({ error: "Failed to start enrollment" }, { status: 500 });

  const accountLabel = session.identity.email ?? session.identity.uid;
  return NextResponse.json({
    data: { secret, uri: buildTotpUri(secret, accountLabel) },
  });
}
