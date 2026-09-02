import { createClient } from "@supabase/supabase-js";

// Service-role client — used only by server-to-server code (Asaas webhook)
// where no user session exists. Same helper shape as apps/web's.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
