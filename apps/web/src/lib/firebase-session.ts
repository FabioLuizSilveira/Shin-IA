"use client";

// Exchanges a fresh Firebase ID token for the httpOnly session cookie
// requireTenantScope() and middleware.ts's edge verifier both read (see
// app/api/auth/firebase/session/route.ts) — a Firebase client-side sign-in
// alone never touches the backend's own session state. Shared by every
// Firebase sign-in entry point (Google, demo, magic/email link) so the
// exchange logic lives in exactly one place.
export async function establishFirebaseSession(idToken: string): Promise<void> {
  const res = await fetch("/api/auth/firebase/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Falha ao estabelecer sessão.");
  // "/" (not a specific dashboard) so middleware's existing role-based
  // redirect (accessCount/homeForUser) decides the destination — same
  // logic already used for every other Firebase entry point.
  window.location.href = "/";
}
