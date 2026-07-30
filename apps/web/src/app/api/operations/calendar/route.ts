import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "year and month (1-12) are required" }, { status: 422 });
  }

  const rangeStart = new Date(year, month - 1, 1).toISOString();
  const rangeEnd = new Date(year, month, 1).toISOString();

  const { data, error } = await supabase
    .from("operations")
    .select("id, type, status, scheduled_starts_at, scheduled_ends_at, resources(name)")
    .is("deleted_at", null)
    .gte("scheduled_starts_at", rangeStart)
    .lt("scheduled_starts_at", rangeEnd)
    .order("scheduled_starts_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
