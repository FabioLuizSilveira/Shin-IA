import { NextResponse, type NextRequest } from "next/server";
import { requireMobileContext } from "@/lib/mobile-context";
import { resolveTrackingVisibility } from "@/lib/mobile-tracking-scope";
import { auditMobileAction } from "@/lib/mobile-audit";
import { internalError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// Wave 3 Phase C — closes gap MOB-003 (history existed at the schema level
// via resource_locations' (resource_id, recorded_at) index, but no route
// ever read it that way — only "latest position" existed before this wave).
// Re-validates authorization for resourceId on every call rather than
// trusting it in isolation, same as api/mobile/tracking/[resourceId]/current.
// Bounded by construction: limit is always clamped to MAX_LIMIT, never
// unlimited.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const { resourceId } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType === "unprovisioned") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const visibility = await resolveTrackingVisibility(context);
  if (visibility?.kind === "ids" && !visibility.resourceIds.includes(resourceId)) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const params_ = req.nextUrl.searchParams;
  const from = params_.get("from");
  const to = params_.get("to");
  const requestedLimit = Number(params_.get("limit"));
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  let query = context.db
    .from("resource_locations")
    .select("latitude, longitude, recorded_at, source")
    .eq("resource_id", resourceId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (visibility?.kind === "tenant") {
    query = query.eq("tenant_id", visibility.tenantId);
  }
  if (from) query = query.gte("recorded_at", from);
  if (to) query = query.lte("recorded_at", to);

  const { data, error } = await query;
  if (error) return internalError(error);

  void auditMobileAction(context.db, context, {
    action: "tracking.history_viewed",
    resource: "resource_location",
    resourceId,
    result: "allowed",
    metadata: { from, to, limit, count: data?.length ?? 0 },
  });

  return NextResponse.json({ data: data ?? [] });
}
