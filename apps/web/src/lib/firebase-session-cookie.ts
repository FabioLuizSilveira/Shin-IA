import { decodeProtectedHeader, importX509, jwtVerify, type KeyLike } from "jose";
import { createClient } from "@supabase/supabase-js";
import type { SessionClaims } from "@/lib/jwt-claims";

export const FIREBASE_SESSION_COOKIE = "__shina_firebase_session";
export const FIREBASE_SESSION_TTL_SECONDS = 5 * 24 * 60 * 60; // 5 days — Firebase's own max for session cookies

// Firebase session cookies are signed by a DIFFERENT key set than ID
// tokens — confirmed live, twice: neither the securetoken JWK endpoint nor
// its x509 sibling had a matching `kid` for a real session cookie's
// header. Session cookies are verifiable only via the identitytoolkit
// "relyingparty" endpoint below (also a {kid: pemCert} map). Using `jose`
// here (not firebase-admin) because firebase-admin depends on Node's
// `crypto` module and does not run in Next.js's Edge middleware runtime;
// `jose` is pure Web Crypto, same reasoning as lib/auth/mfa-cookie.ts's
// HMAC implementation.
const CERTS_URL = "https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys";

let certsCache: { certs: Record<string, string>; fetchedAt: number } | null = null;
const CERTS_CACHE_TTL_MS = 60 * 60 * 1000; // Google's own Cache-Control on this endpoint is ~ this order of magnitude

async function getCert(kid: string): Promise<string | null> {
  if (!certsCache || Date.now() - certsCache.fetchedAt > CERTS_CACHE_TTL_MS) {
    const res = await fetch(CERTS_URL);
    if (!res.ok) return null;
    certsCache = { certs: (await res.json()) as Record<string, string>, fetchedAt: Date.now() };
  }
  return certsCache.certs[kid] ?? null;
}

export async function verifyFirebaseSessionCookie(
  cookieValue: string,
): Promise<{ uid: string } | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  try {
    const { kid } = decodeProtectedHeader(cookieValue);
    if (!kid) return null;
    const pem = await getCert(kid);
    if (!pem) return null;
    const key: KeyLike = await importX509(pem, "RS256");

    const { payload } = await jwtVerify(cookieValue, key, {
      issuer: `https://session.firebase.google.com/${projectId}`,
      audience: projectId,
    });
    if (typeof payload.sub !== "string") return null;
    return { uid: payload.sub };
  } catch {
    return null;
  }
}

// Edge-safe (supabase-js works over plain fetch, no Node-only APIs) —
// mirrors packages/identity's resolveCanonicalIdentity, duplicated rather
// than imported because that function returns a ShinaIdentity, and
// middleware needs the raw SessionClaims shape decodeSessionClaims()
// already produces for the Supabase path, to keep every downstream gate
// (MFA/subscription/contract) provider-agnostic without rewriting them.
export async function resolveFirebaseSessionClaims(
  firebaseUid: string,
): Promise<{ userId: string; claims: SessionClaims } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const admin = createClient(url, serviceKey);

  const { data: link } = await admin
    .from("external_identities")
    .select("shina_user_id")
    .eq("provider", "firebase")
    .eq("provider_subject", firebaseUid)
    .maybeSingle();
  if (!link) return null;

  const shinaUserId = link.shina_user_id as string;
  const { data: ctx, error } = await admin.rpc("resolve_shina_authorization_context", {
    p_user_id: shinaUserId,
  });
  if (error || !ctx) return null;

  return {
    userId: shinaUserId,
    claims: {
      tenant_id: ctx.tenant_id ?? null,
      tenant_role: ctx.tenant_role ?? null,
      platform_role: ctx.platform_role ?? null,
      mfa_enrolled: ctx.mfa_enrolled ?? false,
      platform_subscription_status: ctx.platform_subscription_status ?? null,
      mkt_subscription_status: ctx.mkt_subscription_status ?? null,
      platform_contract_current: ctx.platform_contract_current ?? false,
    },
  };
}
