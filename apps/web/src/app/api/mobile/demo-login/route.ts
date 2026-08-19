import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Public, pre-auth endpoint (whitelisted in middleware.ts's APP_PUBLIC_PATHS)
// backing the mobile app's "Demonstração" button on the login screen. Signs
// in as one of two fixed, dedicated demo accounts against the real Veloz
// Rent a Car tenant — real backend, real data, no mocks — matching the
// explicit product decision to keep mocks/demo data structurally impossible
// in release builds (M22) while still giving a one-tap way to see both
// personas' real experiences. Credentials live in env vars, never in
// source — DEMO_TENANT_EMAIL/DEMO_TENANT_PASSWORD and
// DEMO_CUSTOMER_EMAIL/DEMO_CUSTOMER_PASSWORD.
function accountFor(persona: "tenant" | "customer") {
  if (persona === "tenant") {
    return { email: process.env.DEMO_TENANT_EMAIL, password: process.env.DEMO_TENANT_PASSWORD };
  }
  return { email: process.env.DEMO_CUSTOMER_EMAIL, password: process.env.DEMO_CUSTOMER_PASSWORD };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const persona = body?.persona;
  if (persona !== "tenant" && persona !== "customer") {
    return NextResponse.json({ error: "persona must be 'tenant' or 'customer'" }, { status: 400 });
  }

  const account = accountFor(persona);
  if (!account.email || !account.password) {
    return NextResponse.json({ error: "Demo login not configured" }, { status: 503 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error || !data.session) {
    return NextResponse.json({ error: "Demo login unavailable" }, { status: 502 });
  }

  return NextResponse.json({
    data: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
}
