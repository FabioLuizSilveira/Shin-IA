// Landing-page "puro demo" flow. The marketing site (autoloc.shinaia.com.br)
// links straight to /demo/tenant and /demo/customer here; those pages sign in
// as the fixed demo accounts (see api/mobile/demo-login) and drop the visitor
// into the real persona experience with no login screen. This module is the
// small shared bit: a localStorage flag written on entry and read on sign-out
// so "Sair" sends a demo visitor back to the landing instead of /login.

export const DEMO_FLAG_KEY = "shina_demo";

// The institutional landing lives on its own domain, so this can't be derived
// from window.location. Overridable for previews via NEXT_PUBLIC_LANDING_URL.
export const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? "https://autoloc.shinaia.com.br";

/** Marks the current browser session as a landing-page demo. */
export function markDemoSession(): void {
  try {
    window.localStorage.setItem(DEMO_FLAG_KEY, "1");
  } catch {
    // Private mode / storage disabled — the demo still works, "Sair" just
    // falls back to the normal /login redirect.
  }
}

/**
 * Call right after `supabase.auth.signOut()`. When the session was a demo,
 * clears the flag and returns the landing URL to navigate to; otherwise
 * returns null and the caller keeps its normal post-logout redirect.
 */
export function consumeDemoRedirect(): string | null {
  try {
    if (!window.localStorage.getItem(DEMO_FLAG_KEY)) return null;
    window.localStorage.removeItem(DEMO_FLAG_KEY);
    return LANDING_URL;
  } catch {
    return null;
  }
}
