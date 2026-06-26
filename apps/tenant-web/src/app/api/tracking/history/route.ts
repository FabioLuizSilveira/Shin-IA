import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET /api/tracking/history?deviceId=&from=&to=&limit=
export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("deviceId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(Number(searchParams.get("limit") ?? "500"), 2000);

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 422 });
  }

  const admin = createAdminClient();

  let query = admin
    .from("tracking_positions")
    .select("id, latitude, longitude, altitude, speed, heading, fixed_at, received_at")
    .eq("device_id", deviceId)
    .eq("tenant_id", tenantId)
    .order("fixed_at", { ascending: true })
    .limit(limit);

  if (from) query = query.gte("fixed_at", from);
  if (to) query = query.lte("fixed_at", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count: data?.length ?? 0 });
}
