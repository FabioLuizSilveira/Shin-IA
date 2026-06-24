import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

const TENANT_ID = process.env.DEMO_TENANT_ID!;

export async function GET(req: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString(); // first day of next month

  const admin = createAdminClient();
  const { data } = await admin
    .from("operations")
    .select("id, type, status, scheduled_starts_at, scheduled_ends_at, resources(name)")
    .eq("tenant_id", TENANT_ID)
    .is("deleted_at", null)
    .gte("scheduled_starts_at", start)
    .lt("scheduled_starts_at", end)
    .order("scheduled_starts_at");

  return NextResponse.json({ data: data ?? [] });
}
