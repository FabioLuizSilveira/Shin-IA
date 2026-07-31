import { createBrowserClient } from "@supabase/ssr";

// Shares the auth cookie across app.$ROOT_DOMAIN and mkt.$ROOT_DOMAIN so a
// user never has to log in twice to switch products (see WorkspaceSwitcher).
// Derived from the actual browser hostname, not blindly from
// NEXT_PUBLIC_ROOT_DOMAIN — that env var stays "shinaia.com.br" even in
// local dev, and a cookie Domain that doesn't match (or isn't a parent of)
// the serving host gets silently rejected by the browser.
function authCookieDomain(): string | undefined {
  const host = window.location.hostname;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
  if (host === "localhost" || host.endsWith(".localhost")) return "localhost";
  if (host === root || host.endsWith(`.${root}`)) return `.${root}`;
  return undefined;
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { domain: authCookieDomain() } },
  );
}
