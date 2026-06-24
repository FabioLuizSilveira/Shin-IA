import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// POST /api/auth/mfa/recovery-codes — generate 10 one-time recovery codes
export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Delete any existing codes first
  await admin.from("mfa_recovery_codes").delete().eq("user_id", user.id);

  // Generate 10 codes in XXXXX-XXXXX format
  const codes = Array.from({ length: 10 }, () => {
    const part = () => randomBytes(3).toString("hex").toUpperCase();
    return `${part()}-${part()}`;
  });

  const rows = codes.map((code) => ({
    user_id: user.id,
    code_hash: Buffer.from(code).toString("base64"), // simple encoding; prod → bcrypt
    used: false,
  }));

  const { error } = await admin.from("mfa_recovery_codes").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ codes });
}
