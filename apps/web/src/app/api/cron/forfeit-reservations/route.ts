import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// "Senão perde o sinal" — a reservation whose deposit is paid (status
// 'reserved') but whose balance is still unpaid by the day before the
// rental starts is forfeited: the hold is released (status flips out of
// pending_deposit/reserved, so the DB's own exclusion constraint stops
// blocking that asset/date range for other customers) and the deposit is
// kept, no refund. Runs daily via Vercel Cron (vercel.json); Vercel signs
// these requests with an Authorization: Bearer $CRON_SECRET header
// automatically when CRON_SECRET is set as an env var — this route just
// checks that, same as any other cron endpoint.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: reservations, error } = await admin
    .from("rental_reservations")
    .select("id")
    .eq("status", "reserved")
    .lte("period_starts_at", cutoff);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (reservations ?? []).map((r) => r.id);
  if (ids.length > 0) {
    await admin
      .from("rental_reservations")
      .update({ status: "forfeited", updated_at: new Date().toISOString() })
      .in("id", ids);
  }

  return NextResponse.json({ data: { forfeited: ids.length } });
}
