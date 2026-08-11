import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // Temporary diagnostic (magic link investigation) — remove once resolved.
  console.log("[auth/callback] hit:", request.url);
  const code = searchParams.get("code");
  // Only allow internal paths — a full URL here would be an open redirect.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  // Always redirect to the app subdomain so auth cookies land on the right origin.
  // Falls back to the request origin in local dev when APP_URL is not set.
  const appBase = process.env.NEXT_PUBLIC_APP_URL || origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${appBase}${next}`);
    }
    // Surface the real reason instead of a bare "?error=auth" — the most
    // common cause is opening the magic link in a different browser/device
    // than the one that requested it, which PKCE's code_verifier cookie
    // can't follow (message from Supabase: "both auth code and code
    // verifier should be non-empty").
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      `${appBase}/login?error=auth&reason=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${appBase}/login?error=auth&reason=missing_code`);
}
