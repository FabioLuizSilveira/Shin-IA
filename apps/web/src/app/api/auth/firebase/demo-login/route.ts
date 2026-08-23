import { NextResponse, type NextRequest } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

// Firebase equivalent of /api/mobile/demo-login: mints a custom token for
// one of the two fixed demo accounts server-side, so the client never
// handles (or bundles) the demo account's real password — same posture as
// the Supabase version, adapted to Firebase's sign-in-with-custom-token
// flow instead of a directly-issued access/refresh token pair.
const DEMO_EMAILS: Record<"tenant" | "customer", string | undefined> = {
  tenant: process.env.DEMO_TENANT_EMAIL,
  customer: process.env.DEMO_CUSTOMER_EMAIL,
};

export async function POST(req: NextRequest) {
  const { persona } = (await req.json()) as { persona?: string };
  const email = persona === "tenant" || persona === "customer" ? DEMO_EMAILS[persona] : undefined;
  if (!email) {
    return NextResponse.json({ error: "Invalid persona" }, { status: 400 });
  }

  const auth = getFirebaseAdminAuth();
  try {
    const user = await auth.getUserByEmail(email);
    const customToken = await auth.createCustomToken(user.uid);
    // { data: {...} } — same envelope /api/mobile/demo-login uses, which
    // apps/mobile's shinaia-api.ts request() helper unwraps for every call
    // unconditionally. A bare { customToken } here (the original shape)
    // resolved to `undefined` on the mobile side — confirmed live
    // ("Cannot read property 'customToken' of undefined") — while
    // apps/web's AuthOptions.tsx, which reads the raw response body
    // itself rather than going through that helper, is updated to match.
    return NextResponse.json({ data: { customToken } });
  } catch {
    return NextResponse.json({ error: "Demo account not available" }, { status: 503 });
  }
}
