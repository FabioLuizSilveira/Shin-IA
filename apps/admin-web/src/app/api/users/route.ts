import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminUserProfile } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("user_profiles")
    .select(
      `id, email, full_name, status, phone_number, last_login_at, created_at, tenant_id,
       tenants!inner(id, name)`,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profiles = (
    data as unknown as Array<{
      id: string;
      email: string;
      full_name: string;
      status: AdminUserProfile["status"];
      phone_number: string | null;
      last_login_at: string | null;
      created_at: string;
      tenant_id: string;
      tenants: { id: string; name: string };
    }>
  ).map((row) => ({
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    status: row.status,
    phone_number: row.phone_number ?? undefined,
    last_login_at: row.last_login_at ?? undefined,
    created_at: row.created_at,
    tenant_id: row.tenant_id,
    tenants: row.tenants,
  }));

  return NextResponse.json({ data: profiles as AdminUserProfile[] });
}
