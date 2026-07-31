export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${ROOT_DOMAIN}`;
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const MKT_URL = process.env.NEXT_PUBLIC_MKT_URL ?? "";
// Deep link scheme the rental-customer mobile app (apps/mobile) registers —
// used as the invite email's redirectTo so accepting it opens the app
// instead of a web page.
export const MOBILE_APP_SCHEME =
  process.env.NEXT_PUBLIC_MOBILE_APP_SCHEME ?? "shinacustomer://auth/callback";

/**
 * Returns a URL pointing to the app subdomain.
 * Falls back to a relative path in local dev when NEXT_PUBLIC_APP_URL is not set.
 */
export function appUrl(path: string): string {
  if (!APP_URL) return path;
  return `${APP_URL}${path}`;
}

/** Returns a URL pointing to the Shinã MKT app (workspace switcher). */
export function mktUrl(path: string): string {
  if (!MKT_URL) return path;
  return `${MKT_URL}${path}`;
}
