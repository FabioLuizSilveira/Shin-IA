import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Booked date ranges for one asset, for the reservation calendar to grey
// out — pulled from both real contracts (contract_assets) and live
// rental_reservations holds (pending_deposit/reserved). Only date ranges
// are returned, never who booked them — a customer has no RLS visibility
// into other customers' contracts, and this route deliberately doesn't
// leak that either, it only exposes the shape a calendar needs.
export async function GET(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const assetId = req.nextUrl.searchParams.get("assetId");
  if (!assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }

  const [{ data: contractRanges, error: cErr }, { data: reservationRanges, error: rErr }] =
    await Promise.all([
      context.db
        .from("contract_assets")
        .select("contracts(period_starts_at, period_ends_at, status)")
        .eq("asset_id", assetId),
      context.db
        .from("rental_reservations")
        .select("period_starts_at, period_ends_at, status")
        .eq("asset_id", assetId)
        .in("status", ["pending_deposit", "reserved"]),
    ]);
  if (cErr) return internalError(cErr);
  if (rErr) return internalError(rErr);

  const ranges = [
    ...(
      (contractRanges ?? []) as unknown as {
        contracts: { period_starts_at: string; period_ends_at: string; status: string } | null;
      }[]
    )
      .map((r) => r.contracts)
      .filter(
        (c): c is { period_starts_at: string; period_ends_at: string; status: string } =>
          !!c && (c.status === "active" || c.status === "draft"),
      )
      .map((c) => ({ start: c.period_starts_at, end: c.period_ends_at })),
    ...(reservationRanges ?? []).map((r) => ({ start: r.period_starts_at, end: r.period_ends_at })),
  ];

  return NextResponse.json({ data: ranges });
}
