import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/mobile/customer/upgrade-options?tenantId=&minWeeklyRate= — web
// customer portal's RLS→API migration (rentals-portal.ts's
// fetchUpgradeOptions). tenantId still comes from the query string (the
// caller already knows it from their own contract), but is validated
// against context.organizations before use — a customer of tenant A
// passing tenant B's id gets an empty result, not tenant B's fleet.
export async function GET(req: NextRequest) {
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = req.nextUrl.searchParams.get("tenantId");
  const minWeeklyRate = Number(req.nextUrl.searchParams.get("minWeeklyRate") ?? "0");
  if (!tenantId || !context.organizations.some((o) => o.tenantId === tenantId)) {
    return NextResponse.json({ data: [] });
  }

  const { data, error } = await context.db
    .from("assets")
    .select("id, name, serial_number, metadata")
    .eq("tenant_id", tenantId)
    .eq("status", "available")
    .eq("category", "vehicle");
  if (error) return internalError(error);

  // Same numeric-comparison fix as apps/mobile/src/lib/rentals.ts's
  // fetchUpgradeOptions — comparing metadata->>weekly_rate as text via
  // PostgREST would sort/filter lexicographically, letting cheaper
  // vehicles slip through a server-side gte() filter.
  const filtered = (data ?? [])
    .filter(
      (a) => Number((a.metadata as Record<string, unknown>)?.weekly_rate ?? 0) >= minWeeklyRate,
    )
    .sort(
      (a, b) =>
        Number((a.metadata as Record<string, unknown>)?.weekly_rate ?? 0) -
        Number((b.metadata as Record<string, unknown>)?.weekly_rate ?? 0),
    );

  return NextResponse.json({ data: filtered });
}
