import { NextResponse, type NextRequest } from "next/server";
import { requireTenantScope, isTenantAdmin } from "@/lib/tenant-context";
import { getRoutingMetrics } from "@/lib/ai/observability";

export const dynamic = "force-dynamic";

const MAX_WINDOW_HOURS = 24 * 30;

// Agent Runtime Architecture v2, Wave 6 — admin-only (routing internals
// like tier distribution and fallback rate are operational detail, not
// something every tenant user needs to see, same posture as
// api/ai/credits/* being tenant-scoped but this one narrower still).
// GET ?hours=24 — defaults to the last day, capped at 30 days so a
// request can't force an unbounded tenant_activity_log scan.
export async function GET(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!isTenantAdmin(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const hours = Math.min(
    Number(req.nextUrl.searchParams.get("hours") ?? 24) || 24,
    MAX_WINDOW_HOURS,
  );
  const metrics = await getRoutingMetrics(scope.db, scope.tenantId, hours);
  return NextResponse.json({ data: metrics });
}
