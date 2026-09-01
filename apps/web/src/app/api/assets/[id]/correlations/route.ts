import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 90;

// GET /api/assets/:id/correlations (Etapa 11, P2) — Infractions/
// Operations correlation "without excessive coupling": both tables
// already carry a plain asset_id FK (infraction_cases,
// 20260105000000_infractions_engine.sql; operations,
// 20260066000000_operations_asset_link.sql), so this is two independent
// read-only counts, not a new join/rule engine. Deliberately just counts
// + a recent sample -- no cross-entity inference (e.g. "does an
// infraction correlate with an anomaly") is claimed or computed; that
// would need a real causal model this round doesn't attempt.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: assetId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.maintenance.view"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: asset, error: assetError } = await scope.db
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (assetError) return internalError(assetError);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

  const [infractionsRes, recentInfractionsRes, operationsRes, recentOperationsRes] =
    await Promise.all([
      scope.db
        .from("infraction_cases")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", scope.tenantId)
        .eq("asset_id", assetId),
      scope.db
        .from("infraction_cases")
        .select("id, status, created_at")
        .eq("tenant_id", scope.tenantId)
        .eq("asset_id", assetId)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(5),
      scope.db
        .from("operations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", scope.tenantId)
        .eq("asset_id", assetId),
      scope.db
        .from("operations")
        .select("id, status, created_at")
        .eq("tenant_id", scope.tenantId)
        .eq("asset_id", assetId)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  return NextResponse.json({
    data: {
      windowDays: WINDOW_DAYS,
      infractions: {
        totalCount: infractionsRes.count ?? 0,
        recentCount: recentInfractionsRes.data?.length ?? 0,
        recent: recentInfractionsRes.data ?? [],
      },
      operations: {
        totalCount: operationsRes.count ?? 0,
        recentCount: recentOperationsRes.data?.length ?? 0,
        recent: recentOperationsRes.data ?? [],
      },
    },
  });
}
