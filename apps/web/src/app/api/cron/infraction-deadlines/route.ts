import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sweepInfractionDeadlines } from "@/lib/infraction-deadlines";

export const dynamic = "force-dynamic";

// Daily deadline sweep (item 18/19 of the spec) — same auth pattern as
// the existing api/cron/forfeit-reservations: Vercel signs cron requests
// with Authorization: Bearer $CRON_SECRET automatically. Recomputes
// open/due_soon status for every deadline and fires notifications at the
// 7/3/1-day thresholds plus on becoming overdue, each threshold alerted
// exactly once (see infraction-deadlines.ts's alerted_thresholds column).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await sweepInfractionDeadlines(admin);
  return NextResponse.json({ data: result });
}
