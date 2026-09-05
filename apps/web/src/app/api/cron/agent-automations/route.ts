import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDueAutomations } from "@/lib/ai/automations/run";

export const dynamic = "force-dynamic";

// Wave 8 — same auth pattern as every existing cron route
// (forfeit-reservations, infraction-deadlines): Vercel signs cron-triggered
// requests with Authorization: Bearer $CRON_SECRET automatically.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results = await runDueAutomations(admin);
  return NextResponse.json({ data: { results } });
}
