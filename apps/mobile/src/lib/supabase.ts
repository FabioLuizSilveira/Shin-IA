import { createClient } from "@supabase/supabase-js";
import { secureSessionStore } from "./secure-session-store";

// M22.1 — canonical config is the publishable key; ANON_KEY is accepted as a
// legacy fallback only (same key material under Supabase's newer naming —
// no behavior difference, just which env var name a given project still
// uses). Never SERVICE_ROLE/SECRET/DB password — those never belong here.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy EXPO_PUBLIC_SUPABASE_ANON_KEY) must be set (see .env.example)",
  );
}

// Same Supabase project as apps/web and apps/mkt — rental customer identity
// (rental_customers / rental_customer_organizations / contract_assets /
// rental_service_requests, see supabase/migrations/20260055000000) is
// authorized entirely through RLS, so this app talks to Postgres directly
// via PostgREST instead of going through apps/web's cookie-only API routes.
// Security fix (MÉD-11): session (including refresh token) is now
// encrypted at rest — see secure-session-store.ts.
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: secureSessionStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
