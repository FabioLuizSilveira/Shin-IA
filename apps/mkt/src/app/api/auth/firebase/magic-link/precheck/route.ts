import { NextResponse, type NextRequest } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// POST /api/auth/firebase/magic-link/precheck — mirrors apps/web's
// identical route. Firebase's sendSignInLinkToEmail() has no equivalent of
// Supabase's shouldCreateUser: false; calling it unconditionally would let
// anyone self-register just by typing an email. Only an email with an
// existing Firebase account gets a real link sent (checked client-side, see
// /login's handleFirebaseMagicLink) — this route only answers "does that
// account exist," it never sends anything itself, and always responds the
// same shape regardless of the answer so timing/shape here doesn't leak
// which branch was hit.
export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string };
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const auth = getFirebaseAdminAuth();
  try {
    await auth.getUserByEmail(email);
    return NextResponse.json({ data: { allowed: true } });
  } catch {
    return NextResponse.json({ data: { allowed: false } });
  }
}
