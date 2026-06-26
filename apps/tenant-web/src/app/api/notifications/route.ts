import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET — list in_app notifications for demo tenant
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .select("id, subject, body, priority, status, created_at")
    .eq("tenant_id", process.env.DEMO_TENANT_ID!)
    .eq("channel", "in_app")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH — mark notifications as read
export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { ids?: string[]; all?: boolean };
  const admin = createAdminClient();

  let query = admin
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("tenant_id", process.env.DEMO_TENANT_ID!)
    .eq("channel", "in_app");

  if (body.all) {
    query = query.neq("status", "read");
  } else if (body.ids?.length) {
    query = query.in("id", body.ids);
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
