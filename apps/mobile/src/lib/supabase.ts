import { createClient } from "@supabase/supabase-js";
import { secureSessionStore } from "./secure-session-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.example)",
  );
}

// Same Supabase project as apps/web and apps/mkt — rental customer identity
// (rental_customers / rental_customer_organizations / contract_assets /
// rental_service_requests, see supabase/migrations/20260055000000) is
// authorized entirely through RLS, so this app talks to Postgres directly
// via PostgREST instead of going through apps/web's cookie-only API routes.
// Security fix (MÉD-11): session (including refresh token) is now
// encrypted at rest — see secure-session-store.ts.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
