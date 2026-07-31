import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MFA_COOKIE_NAME, verifyMfaCookie } from "@/lib/auth/mfa-cookie";
import { decodeSessionClaims, type SessionClaims } from "@/lib/jwt-claims";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation-cookie";

// ── Domain config ──────────────────────────────────────────────────────────────
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? `https://app.${ROOT_DOMAIN}`;

// Paths served exclusively by the institutional landing (root/www domain)
const SITE_PATHS = ["/", "/pricing", "/contact", "/about", "/demo"];

// Paths that are public within the app subdomain (no auth required).
// /api/webhooks is called server-to-server by Stripe — no user session
// ever exists for it, so it must never redirect to /login.
const APP_PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/onboarding",
  "/api/onboarding",
  "/api/auth",
  "/api/webhooks",
];

// Roles that require MFA enrollment before accessing the platform
const MFA_REQUIRED_ROLES = new Set(["owner", "admin", "financial_manager"]);

// ── Helpers ────────────────────────────────────────────────────────────────────

type HostType = "root" | "app" | "local";

function getHostType(hostname: string): HostType {
  const bare = hostname.split(":")[0]; // strip port
  if (bare === "localhost" || bare === "127.0.0.1") return "local";
  if (bare === `app.${ROOT_DOMAIN}` || bare === "app.localhost") return "app";
  return "root"; // shinaia.com.br, www.shinaia.com.br, etc.
}

/** Returns true when the path belongs to the institutional landing */
function isSitePath(pathname: string): boolean {
  return SITE_PATHS.some((p) => {
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

/** Returns true when the path is public within the app subdomain */
function isAppPublicPath(pathname: string): boolean {
  return APP_PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

// Supabase call, bounded so a DNS/network hiccup reaching the auth API fails
// fast instead of hanging the middleware until Vercel's hard 25s timeout —
// same fix already applied to apps/mkt/src/middleware.ts after a production
// incident. Without this, a Supabase blip turns into a site-wide 504.
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(8000) });
}

// ── Middleware ─────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const hostType = getHostType(hostname);
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");

  // ── Root / www domain ──────────────────────────────────────────────────────
  // Only the institutional landing is served here.
  // Any app or auth route gets a permanent redirect to app.shinaia.com.br.
  if (hostType === "root") {
    if (!isSitePath(pathname) && !isApiRoute) {
      const target = new URL(pathname + request.nextUrl.search, APP_URL);
      return NextResponse.redirect(target.toString(), { status: 308 });
    }
    return NextResponse.next();
  }

  // ── App subdomain + localhost ──────────────────────────────────────────────
  // Run the full auth / MFA middleware.

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
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

  const isPublic = isAppPublicPath(pathname) || isSitePath(pathname);

  // Public paths that never inspect `user` (everything except "/" and
  // "/login", which redirect differently for signed-in visitors) skip the
  // Supabase round trip entirely — this is what actually keeps a webhook
  // or a marketing page up during a Supabase auth hiccup, the timeout above
  // is only a fallback for paths that truly need the session.
  if (isPublic && pathname !== "/" && pathname !== "/login") {
    return supabaseResponse;
  }

  // getUser() (not getSession()) so the session is actually revalidated —
  // but user.app_metadata reflects auth.users' stored column, not the
  // tenant_role/platform_role claims custom_access_token_hook injects into
  // the issued JWT, so role checks below decode the session's access token
  // instead (see jwt-claims.ts).
  const user = await supabase.auth
    .getUser()
    .then(({ data }) => data.user)
    .catch(() => null);

  const claims: SessionClaims = user
    ? await supabase.auth
        .getSession()
        .then(({ data }) => (data.session ? decodeSessionClaims(data.session.access_token) : {}))
        .catch(() => ({}))
    : {};

  // ── 1. App subdomain "/" → login or dashboard ──────────────────────────────
  if (hostType === "app" && pathname === "/") {
    const url = request.nextUrl.clone();
    if (user) {
      url.pathname = claims.platform_role ? "/platform/dashboard" : "/tenant/dashboard";
    } else {
      url.pathname = "/login";
    }
    return NextResponse.redirect(url);
  }

  // ── 2. Unauthenticated → redirect to login / 401 ──────────────────────────
  if (!user && !isPublic) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ── 2.5. Cross-role route guard for /tenant and /platform ──────────────────
  // A platform admin has no tenant_id claim of their own, so /tenant/* pages
  // are only reachable while an impersonation session cookie is present —
  // deep validation (expiry, ownership) happens per-request in
  // requireTenantScope(). A tenant user has no platform_role, so /platform/*
  // is off-limits outright.
  if (user && hostType === "app") {
    if (pathname.startsWith("/tenant") && !claims.tenant_id) {
      const url = request.nextUrl.clone();
      if (claims.platform_role) {
        const hasImpersonation = request.cookies.get(IMPERSONATION_COOKIE)?.value;
        if (!hasImpersonation) {
          url.pathname = "/platform/tenants";
          return NextResponse.redirect(url);
        }
      } else {
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    }

    if (pathname.startsWith("/platform") && !claims.platform_role) {
      const url = request.nextUrl.clone();
      url.pathname = "/tenant/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // ── 3. Authenticated on /login or /dashboard → role-based redirect ─────────
  if (user && (pathname === "/login" || pathname === "/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = claims.platform_role ? "/platform/dashboard" : "/tenant/dashboard";
    return NextResponse.redirect(url);
  }

  // ── 4. MFA enforcement ────────────────────────────────────────────────────
  if (user && !isPublic) {
    const role = claims.tenant_role ?? claims.platform_role ?? null;
    const mfaEnrolled = claims.mfa_enrolled ?? false;

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

    const mfaCookie = request.cookies.get(MFA_COOKIE_NAME)?.value;
    const mfaVerified = mfaCookie ? await verifyMfaCookie(mfaCookie, user.id) : false;

    const mfaChallengeRequired =
      !mfaVerified &&
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

  // ── 5. Tell crawlers not to index the app subdomain ───────────────────────
  if (hostType === "app") {
    supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
