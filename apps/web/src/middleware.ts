import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Public routes (no auth required) ──────────────────────────────────────────
const PUBLIC_PATHS = ["/login", "/auth", "/onboarding", "/api/onboarding", "/api/auth"];

// ── MFA-enforcement paths (require mfa_enrolled if role mandates) ─────────────
// Roles that MUST have MFA enrolled before accessing the platform
const MFA_REQUIRED_ROLES = new Set(["owner", "admin", "financial_manager"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates the JWT server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const isApiRoute = pathname.startsWith("/api");

  // ── 1. Unauthenticated → redirect / 401 ────────────────────────────────────
  if (!user && !isPublic) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ── 2. Authenticated on /login → redirect to dashboard ─────────────────────
  if (user && pathname === "/login") {
    const appMeta = user.app_metadata as {
      tenant_role?: string;
      platform_role?: string;
    };
    const url = request.nextUrl.clone();
    if (appMeta.platform_role) {
      url.pathname = "/platform/dashboard";
    } else {
      url.pathname = "/tenant/dashboard";
    }
    return NextResponse.redirect(url);
  }

  // ── 3. MFA enforcement (read from JWT custom claims — no extra DB query) ────
  if (user && !isPublic) {
    // Claims are injected by the custom-access-token Edge Function hook
    const appMeta = user.app_metadata as {
      tenant_role?: string;
      platform_role?: string;
      mfa_enrolled?: boolean;
    };

    const role = appMeta.tenant_role ?? appMeta.platform_role ?? null;
    const mfaEnrolled = appMeta.mfa_enrolled ?? false;

    // If role requires MFA but not enrolled → redirect to MFA setup
    // Skip if already heading to /auth/mfa-setup
    if (
      role &&
      MFA_REQUIRED_ROLES.has(role) &&
      !mfaEnrolled &&
      !pathname.startsWith("/auth/mfa") &&
      !pathname.startsWith("/settings")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/mfa-setup";
      return NextResponse.redirect(url);
    }

    // If role requires MFA, enrolled but session not verified → challenge
    // (session_trust_level check would come from a separate session cookie)
    const mfaChallengeRequired =
      request.cookies.get("mfa_verified")?.value !== "1" &&
      role &&
      MFA_REQUIRED_ROLES.has(role) &&
      mfaEnrolled &&
      !pathname.startsWith("/auth/mfa") &&
      !pathname.startsWith("/settings");

    if (mfaChallengeRequired) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/mfa-challenge";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
