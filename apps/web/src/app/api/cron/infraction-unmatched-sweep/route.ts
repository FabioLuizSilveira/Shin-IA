import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sweepUnmatchedInfractions } from "@/lib/infraction-unmatched-sweep";

export const dynamic = "force-dynamic";

// Item 32 of the spec — daily reprocessing sweep for genuinely
// tenant-unknown UNMATCHED cases, same CRON_SECRET auth pattern as
// infraction-deadlines and forfeit-reservations.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const result = await sweepUnmatchedInfractions(admin);
  return NextResponse.json({ data: result });
}
