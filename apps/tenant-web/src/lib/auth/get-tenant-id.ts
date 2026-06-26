import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getTenantId(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return process.env.DEMO_TENANT_ID!;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("tenant_id")
    .eq("auth_user_id", user.id)
    .single();

  return (data?.tenant_id as string | undefined) ?? process.env.DEMO_TENANT_ID!;
}
