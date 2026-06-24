import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/iam/roles — list tenant roles with user counts
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const admin = createAdminClient();

  // Get all tenant roles
  const { data: roles, error } = await admin
    .from("iam_tenant_roles")
    .select("id, name, display_name, description, is_system")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get user counts per role
  const { data: userCounts } = await admin
    .from("iam_tenant_user_roles")
    .select("role_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const countMap = new Map<string, number>();
  for (const row of userCounts ?? []) {
    countMap.set(row.role_id, (countMap.get(row.role_id) ?? 0) + 1);
  }

  const enriched = (roles ?? []).map((r) => ({
    ...r,
    user_count: countMap.get(r.id) ?? 0,
  }));

  return NextResponse.json({ data: enriched });
}
