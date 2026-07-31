import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decodeSessionClaims, hasLiveSubscription } from "@shina/billing-platform/claims";

// Public routes: landing, pricing, signup, login and auth callbacks.
// /api/mcp authenticates via Authorization bearer header, not cookies.
// /api/checkout is hit by unauthenticated visitors starting a subscription.
// /api/webhooks is called server-to-server by Stripe — no user session
// ever exists for it, so it must never redirect to /login.
const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/signup",
  "/login",
  "/auth",
  "/api/auth",
  "/api/mcp",
  "/api/checkout",
  "/api/webhooks",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => {
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

// Supabase call, bounded so a DNS/network hiccup reaching the auth API fails
// fast instead of hanging the middleware until Vercel's hard 25s timeout
// (which previously turned a Supabase blip into a site-wide 504).
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, signal: AbortSignal.timeout(8000) });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const isApiRoute = pathname.startsWith("/api");

  // Marketing/public pages don't need a session — skip the Supabase round
  // trip entirely. /login is the one public path that still needs to know
  // whether a user is already signed in (to bounce them to /dashboard).
  if (isPublic && pathname !== "/login") {
    return NextResponse.next({ request });
  }

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

  const user = await supabase.auth
    .getUser()
    .then(({ data }) => data.user)
    .catch(() => null);

  if (!user && !isPublic) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ── Subscription gate ──────────────────────────────────────────────────────
  // App pages (dashboard etc.) need a live MKT subscription. The status
  // comes from the JWT claim custom_access_token_hook injects
  // (mkt_subscription_status) — no extra DB round trip here. Access is only
  // ever granted by the Stripe webhook writing platform_subscriptions, so a
  // user straight off the success page without a processed webhook still
  // lands back on /signup. API routes keep their own route-level auth.
  if (user && !isPublic && !isApiRoute) {
    const claims = await supabase.auth
      .getSession()
      .then(({ data }) => (data.session ? decodeSessionClaims(data.session.access_token) : {}))
      .catch(() => ({}) as ReturnType<typeof decodeSessionClaims>);
    if (!hasLiveSubscription(claims.mkt_subscription_status)) {
      const url = request.nextUrl.clone();
      url.pathname = "/signup";
      url.searchParams.set("upgrade", "1");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
