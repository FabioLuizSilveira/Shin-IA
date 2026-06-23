import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name, slug, plan, status, created_at")
    .eq("id", process.env.DEMO_TENANT_ID!)
    .single();
  return NextResponse.json({ data });
}
