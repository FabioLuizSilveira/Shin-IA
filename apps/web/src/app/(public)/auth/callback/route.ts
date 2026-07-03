import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Always redirect to the app subdomain so auth cookies land on the right origin.
  // Falls back to the request origin in local dev when APP_URL is not set.
  const appBase = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${appBase}${next}`);
    }
  }

  return NextResponse.redirect(`${appBase}/login?error=auth`);
}
