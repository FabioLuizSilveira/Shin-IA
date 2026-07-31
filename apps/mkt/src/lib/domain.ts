export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
export const MKT_URL = process.env.NEXT_PUBLIC_MKT_URL ?? "";

/** Returns a URL pointing to the Shinã Platform app (workspace switcher). */
export function appUrl(path: string): string {
  if (!APP_URL) return path;
  return `${APP_URL}${path}`;
}
