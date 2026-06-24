import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

const TENANT_ID = process.env.DEMO_TENANT_ID!;

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("operations")
    .select("id, type, status, scheduled_starts_at, resources(name)")
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .in("status", ["pending", "in_progress"])
    .gte("scheduled_starts_at", new Date().toISOString())
    .order("scheduled_starts_at")
    .limit(5);

  return NextResponse.json({ data: data ?? [] });
}
