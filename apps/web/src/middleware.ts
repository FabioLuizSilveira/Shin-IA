import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasLiveSubscription } from "@shina/billing-platform/claims";
import { resolveActiveIdentityProviderKind } from "@shina/identity";
import { MFA_COOKIE_NAME, verifyMfaCookie } from "@/lib/auth/mfa-cookie";
import { decodeSessionClaims, type SessionClaims } from "@/lib/jwt-claims";
import {
  FIREBASE_SESSION_COOKIE,
  verifyFirebaseSessionCookie,
  resolveFirebaseSessionClaims,
} from "@/lib/firebase-session-cookie";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation-cookie";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// ── Domain config ──────────────────────────────────────────────────────────────
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? `https://app.${ROOT_DOMAIN}`;

// Paths served exclusively by the institutional landing (root/www domain)
const SITE_PATHS = [
  "/",
  "/pricing",
  "/contact",
  "/about",
  "/demo",
  "/privacidade",
  "/termos",
  // Next.js metadata routes (app/robots.ts, app/sitemap.ts) plus the
  // static public/llms.txt — the middleware matcher only excludes image
  // extensions (see config.matcher below), so these .txt/.xml requests
  // were falling through to the same "not a site path → redirect to the
  // app subdomain → not authenticated → redirect to /login" chain as any
  // other unknown path. Search Console/llms.txt validators were literally
  // receiving the login page's HTML instead of these files.
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
];

// Paths that are public within the app subdomain (no auth required).
// /api/webhooks is called server-to-server by Asaas — no user session
// ever exists for it, so it must never redirect to /login.
const APP_PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  // /onboarding (the page) stays public so an unauthenticated visitor can
  // land on it and see the login step (Unified Commercial Flow: login
  // happens first, inside the wizard). /api/onboarding/* is deliberately
  // NOT public anymore — /complete and /status both require a real session
  // now that contract_acceptances.user_id is never null.
  "/onboarding",
  // Linked from /onboarding's footer and required by Apple's TestFlight
  // Beta App Review (Privacy Policy URL) — must be reachable with no
  // session on both the marketing domain (SITE_PATHS) and the app
  // subdomain, since /onboarding itself lives on the app subdomain.
  "/privacidade",
  "/termos",
  "/api/commercial",
  "/api/auth",
  "/api/webhooks",
  "/rentals/login",
  // The mobile app's "Demonstração" button calls this before any session
  // exists — it signs in as one of two fixed demo accounts and returns
  // real tokens, same pre-auth posture as /api/auth.
  "/api/mobile/demo-login",
  // Public "Fale com nossa equipe" contact form -- creates a crm_leads row
  // with no session involved, same pre-auth posture as demo-login above.
  "/api/contact",
  // Asaas payment success/cancel landing page for the mobile app's
  // renewal/reservation flow — no session exists when the customer's
  // in-app browser lands here after paying (or cancelling).
  "/mobile/payment-complete",
  // Inspection report public verification (item 8 of the Inspection
  // Engine V1 spec) — the whole point of the QR code on a printed laudo
  // is that anyone who scans it, logged in or not, gets a
  // valid/invalid confirmation. Redirecting to /login here would defeat
  // it entirely. /api/verify backs the page; /api/share is the separate
  // secure-share-link PDF download, also unauthenticated by design (the
  // token itself is the credential, checked inside the route).
  "/verify/inspection-report",
  "/api/verify",
  "/api/share",
];

// Roles that require MFA enrollment before accessing the platform.
// Security fix (ALTO-09): this used to be ["owner", "admin",
// "financial_manager"] — keys that never matched
// lib/tenant-provisioning.ts's real SYSTEM_ROLES keys ("tenant_owner",
// "tenant_admin"; "financial_manager" was never a real role at all), so
// this gate had never actually fired for any provisioned tenant. Fixed by
// explicit decision, accepting the blast radius: every existing
// tenant_owner/tenant_admin without MFA enrolled (confirmed 3/3 in the
// hosted DB at fix time) is redirected to /auth/mfa-setup on their next
// request. No rollout/grace period — this was a deliberate choice, not an
// oversight (see the audit's ALTO-09 finding for the pre-fix state).
const MFA_REQUIRED_ROLES = new Set(["tenant_owner", "tenant_admin"]);

// Security fix (ALTO-08): tighter budget for auth-sensitive paths (login,
// OAuth, magic link, MFA challenge/recovery) — these are the ones brute
// force / credential stuffing actually targets. See lib/rate-limit.ts for
// caveats (in-memory, per-instance).
const AUTH_PATH_PREFIXES = ["/login", "/auth", "/api/auth"];
const AUTH_RATE_LIMIT = { maxRequests: 20, windowMs: 60_000 };
// Looser general budget for the rest of the API surface — sized to not
// interfere with a dashboard page firing several parallel fetches, while
// still bounding scraping/enumeration and accidental retry storms.
const API_RATE_LIMIT = { maxRequests: 120, windowMs: 60_000 };

// ── Helpers ────────────────────────────────────────────────────────────────────

type HostType = "root" | "app" | "local";

function getHostType(hostname: string): HostType {
  const bare = hostname.split(":")[0]; // strip port
  if (bare === "localhost" || bare === "127.0.0.1") return "local";
  if (bare === `app.${ROOT_DOMAIN}` || bare === "app.localhost") return "app";
  // Vercel Preview deployments get a random *.vercel.app hostname that can
  // never match app.${ROOT_DOMAIN} — without this, every preview URL is
  // treated as the root marketing domain, and any non-marketing path (e.g.
  // /login) 308-redirects straight to production's real app.shinaia.com.br,
  // making it impossible to test the app (e.g. a different
  // IDENTITY_PROVIDER) on a preview deployment. Scoped to VERCEL_ENV ===
  // "preview" only, which Vercel sets server-side and is never "preview" in
  // Production — this can never change production routing.
  if (process.env.VERCEL_ENV === "preview" && bare.endsWith(".vercel.app")) return "app";
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

// The mobile app (and any other non-browser API client) has no cookie jar —
// it authenticates every /api/* call with an Authorization: Bearer <token>
// header instead. This middleware's own session check (below) is cookie-only
// (createServerClient's getUser()), so without this, every such call 401'd
// here before ever reaching the route — the route's own bearer-aware auth
// (requireMobileContext()/requireTenantScope()) never even ran. Verifying
// the token itself is deliberately NOT done here: that's the route's job
// (a real auth.getUser(token) call), this only decides whether to defer to
// it instead of enforcing the cookie-only gate below.
function hasBearerAuth(request: NextRequest): boolean {
  return (request.headers.get("authorization") ?? "").toLowerCase().startsWith("bearer ");
}

// A rental customer's session carries neither platform_role nor tenant_id
// (see supabase/migrations/20260055000000_rental_customers.sql — that model
// is deliberately claims-free). Landing such a user on /tenant/dashboard
// used to cause a redirect loop: the /tenant guard (2.5) bounces them to
// /login (no tenant_id), which then bounces right back here. Route them to
// their own portal instead.
function homeForUser(claims: SessionClaims): string {
  if (claims.platform_role) return "/platform/dashboard";
  if (claims.tenant_id) return "/tenant/dashboard";
  return "/rentals";
}

// How many distinct products this session can reach: platform admin,
// tenant portal, and Shinã MKT (a live subscription, decoupled from
// tenant_id/platform_role — see hasLiveSubscription). A user who was never
// meant to juggle products (the overwhelming majority) sees none of this —
// only accounts holding 2+ go through /choose-workspace instead of being
// silently dropped into whichever homeForUser() picks first.
function accessCount(claims: SessionClaims): number {
  let count = 0;
  if (claims.platform_role) count++;
  if (claims.tenant_id) count++;
  if (hasLiveSubscription(claims.mkt_subscription_status)) count++;
  return count;
}

// Supabase call, bounded so a DNS/network hiccup reaching the auth API fails
// fast instead of hanging the middleware until Vercel's hard 25s timeout —
// same fix already applied to apps/mkt/src/middleware.ts after a production
// incident. Without this, a Supabase blip turns into a site-wide 504.
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(8000) });
}

// Same cross-subdomain cookie-domain logic as lib/supabase/{client,server}.ts
// — a session cookie refreshed here must keep the shared domain, or the
// workspace switcher's "no second login" breaks on the next token refresh.
function authCookieDomain(hostname: string): string | undefined {
  const host = hostname.split(":")[0];
  if (host === "localhost" || host.endsWith(".localhost")) return "localhost";
  if (host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`)) return `.${ROOT_DOMAIN}`;
  return undefined;
}

// ── Middleware ─────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const hostType = getHostType(hostname);
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");

  // Temporary diagnostic (magic link investigation) — remove once resolved.
  if (pathname.startsWith("/auth") || pathname === "/login" || pathname === "/") {
    console.log("[middleware] hit:", hostname, request.nextUrl.pathname + request.nextUrl.search);
  }

  // ── -1. Stray PKCE code landing outside /auth/callback ─────────────────────
  // Confirmed in production: Supabase's magic-link/OAuth PKCE verify step
  // does not reliably honor a custom redirect_to here — it lands on the
  // bare site_url ("/") with a "?code=..." query no matter what redirect_to
  // was requested (tried with and without a query string, and with both
  // wildcard and exact-match entries in the allow-list; none changed this).
  // Since /auth/callback is the only place that knows how to exchange that
  // code for a session, forward it there instead of letting "/" treat it as
  // a plain unauthenticated visit and silently drop the code.
  if (pathname !== "/auth/callback" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // ── 0. Rate limiting on auth-sensitive paths ───────────────────────────────
  if (AUTH_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const { allowed, retryAfterSeconds } = checkRateLimit(
      `auth:${clientIp(request)}`,
      AUTH_RATE_LIMIT.maxRequests,
      AUTH_RATE_LIMIT.windowMs,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }
  }

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

  const identityProviderKind = resolveActiveIdentityProviderKind(process.env);

  const isPublic = isAppPublicPath(pathname) || isSitePath(pathname);

  // Public paths that never inspect `user` (everything except "/" and
  // "/login", which redirect differently for signed-in visitors) skip the
  // session round trip entirely — this is what actually keeps a webhook or
  // a marketing page up during an auth-provider hiccup, the timeout below
  // is only a fallback for paths that truly need the session.
  if (isPublic && pathname !== "/" && pathname !== "/login") {
    return supabaseResponse;
  }

  let user: { id: string } | null = null;
  let claims: SessionClaims = {};

  if (identityProviderKind === "firebase") {
    // Edge-safe verification (jose, not firebase-admin — see
    // lib/firebase-session-cookie.ts) of the cookie apps/web/src/app/api/
    // auth/firebase/session/route.ts mints. No revocation check happens
    // here (that needs the Admin SDK, Node-only) — this only gates
    // redirects; the actual data-access routes re-verify via
    // requireTenantScope() -> FirebaseIdentityProvider, which does use the
    // Admin SDK and would still reject a revoked session.
    const sessionCookie = request.cookies.get(FIREBASE_SESSION_COOKIE)?.value;
    if (sessionCookie) {
      const verified = await verifyFirebaseSessionCookie(sessionCookie);
      const resolved = verified ? await resolveFirebaseSessionClaims(verified.uid) : null;
      if (resolved) {
        user = { id: resolved.userId };
        claims = resolved.claims;
      }
    }
  } else {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { fetch: fetchWithTimeout },
        cookieOptions: { domain: authCookieDomain(hostname) },
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

    // getUser() (not getSession()) so the session is actually revalidated —
    // but user.app_metadata reflects auth.users' stored column, not the
    // tenant_role/platform_role claims custom_access_token_hook injects into
    // the issued JWT, so role checks below decode the session's access token
    // instead (see jwt-claims.ts).
    user = await supabase.auth
      .getUser()
      .then(({ data }) => data.user)
      .catch(() => null);

    claims = user
      ? await supabase.auth
          .getSession()
          .then(({ data }) => (data.session ? decodeSessionClaims(data.session.access_token) : {}))
          .catch(() => ({}))
      : {};
  }

  // ── General API rate limiting ──────────────────────────────────────────────
  // /api/webhooks and /api/auth already returned/were checked above — this
  // covers the rest of the ~85 API routes. Keyed by user id when known
  // (a shared office IP shouldn't collide into one bucket), IP otherwise.
  if (isApiRoute) {
    const { allowed, retryAfterSeconds } = checkRateLimit(
      `api:${user?.id ?? clientIp(request)}`,
      API_RATE_LIMIT.maxRequests,
      API_RATE_LIMIT.windowMs,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }
  }

  // ── 1. App subdomain "/" → login or dashboard ──────────────────────────────
  if (hostType === "app" && pathname === "/") {
    const url = request.nextUrl.clone();
    if (user) {
      url.pathname = accessCount(claims) > 1 ? "/choose-workspace" : homeForUser(claims);
    } else {
      url.pathname = "/login";
    }
    return NextResponse.redirect(url);
  }

  // ── 2. Unauthenticated → redirect to login / 401 ──────────────────────────
  if (!user && !isPublic) {
    if (isApiRoute) {
      // Defer to the route's own bearer-token auth instead of rejecting a
      // real mobile-client request that simply has no cookies to check here.
      if (hasBearerAuth(request)) {
        return supabaseResponse;
      }
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

  // ── 2.6. Subscription gate for tenant pages ────────────────────────────────
  // Only real tenant users are gated (claims.tenant_id present) — an
  // impersonating platform admin bypasses it, since support has to be able
  // to reach a suspended tenant. /tenant/billing stays reachable so a
  // blocked tenant can fix payment; API routes keep their own route-level
  // auth and aren't gated here (the billing page's own APIs must still work).
  if (
    user &&
    claims.tenant_id &&
    !isApiRoute &&
    pathname.startsWith("/tenant") &&
    !pathname.startsWith("/tenant/billing") &&
    !hasLiveSubscription(claims.platform_subscription_status)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/tenant/billing";
    url.searchParams.set("upgrade", "1");
    return NextResponse.redirect(url);
  }

  // ── 2.7. Material contract re-acceptance gate ───────────────────────────────
  // item 23: a new contract_version flagged material_change=true blocks
  // sensitive admin pages until re-accepted — but never blocks billing (so a
  // tenant can still see/pay invoices), the reaccept page itself, or data
  // export/regularization routes (item 10's explicit carve-out).
  if (
    user &&
    claims.tenant_id &&
    !isApiRoute &&
    claims.platform_contract_current === false &&
    pathname.startsWith("/tenant") &&
    !pathname.startsWith("/tenant/billing") &&
    !pathname.startsWith("/tenant/legal")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/tenant/legal/reaccept";
    return NextResponse.redirect(url);
  }

  // ── 3. Authenticated on /login or /dashboard → role-based redirect ─────────
  if (user && (pathname === "/login" || pathname === "/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = accessCount(claims) > 1 ? "/choose-workspace" : homeForUser(claims);
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
