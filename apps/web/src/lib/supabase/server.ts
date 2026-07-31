import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

// Same cross-subdomain cookie-domain logic as lib/supabase/client.ts, but
// reading the Host header (no window on the server) — see that file for why
// this can't just read NEXT_PUBLIC_ROOT_DOMAIN directly.
async function authCookieDomain(): Promise<string | undefined> {
  const headerStore = await headers();
  const host = (headerStore.get("host") ?? "").split(":")[0];
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "shinaia.com.br";
  if (host === "localhost" || host.endsWith(".localhost")) return "localhost";
  if (host === root || host.endsWith(`.${root}`)) return `.${root}`;
  return undefined;
}

export async function createClient() {
  const cookieStore = await cookies();
  const domain = await authCookieDomain();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}
