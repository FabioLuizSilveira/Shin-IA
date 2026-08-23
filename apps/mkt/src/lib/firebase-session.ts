"use client";

// Exchanges a fresh Firebase ID token for the httpOnly session cookie
// middleware.ts's edge verifier reads (see app/api/auth/firebase/session/
// route.ts) — a Firebase client-side sign-in alone never touches the
// backend's own session state. Shared by every Firebase sign-in entry point
// (Google, magic link) so the exchange logic lives in exactly one place.
// Unlike apps/web's version, this takes an explicit destination — mkt's
// middleware has no role-based "/" redirect (public marketing page lives at
// "/"), so the caller (the existing `next` param logic in /login) decides
// where an authenticated user lands, same as the Supabase flow already did.
export async function establishFirebaseSession(idToken: string, next: string): Promise<void> {
  const res = await fetch("/api/auth/firebase/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Falha ao estabelecer sessão.");
  window.location.href = next;
}
