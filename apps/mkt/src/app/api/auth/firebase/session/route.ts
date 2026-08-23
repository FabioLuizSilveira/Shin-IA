import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";
import {
  FIREBASE_SESSION_COOKIE,
  FIREBASE_SESSION_TTL_SECONDS,
} from "@/lib/firebase-session-cookie";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";

// Same cross-subdomain cookie-domain logic as apps/web's version and
// middleware.ts's authCookieDomain() — a session minted here (mkt.$ROOT_
// DOMAIN) must be readable on app.$ROOT_DOMAIN and vice versa, same as the
// existing Supabase cookie already is (the workspace switcher depends on
// this for "no second login").
async function cookieDomain(): Promise<string | undefined> {
  const headerStore = await headers();
  const host = (headerStore.get("host") ?? "").split(":")[0];
  if (host === "localhost" || host.endsWith(".localhost")) return "localhost";
  if (host === ROOT_DOMAIN || host.endsWith(`.${ROOT_DOMAIN}`)) return `.${ROOT_DOMAIN}`;
  return undefined;
}

// Exchanges a short-lived Firebase ID token (from the client SDK, just after
// sign-in) for a long-lived session cookie, mirroring Firebase's own
// documented Next.js session pattern. Mirrors apps/web's identical route —
// this is the only place apps/mkt mints FIREBASE_SESSION_COOKIE.
export async function POST(req: NextRequest) {
  const { idToken } = await req.json();
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  const auth = getFirebaseAdminAuth();
  try {
    // Re-verify server-side before minting a cookie from it — never trust a
    // client-supplied token at face value, even though createSessionCookie
    // itself also validates it.
    await auth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid ID token" }, { status: 401 });
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: FIREBASE_SESSION_TTL_SECONDS * 1000,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(FIREBASE_SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    // http://localhost never gets a Secure cookie back — browsers (and
    // curl) silently drop it, which looked like an auth failure everywhere
    // downstream until traced back here (same finding as apps/web).
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: await cookieDomain(),
    maxAge: FIREBASE_SESSION_TTL_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(FIREBASE_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: await cookieDomain(),
    maxAge: 0,
  });
  return res;
}
