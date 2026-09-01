import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { auditFleet, type FleetAssetSignal } from "@shina/maintenance-engine";
import {
  toolGetAssetHealthScore,
  toolGetAssetPredictiveRisk,
} from "@/lib/maintenance-copilot-tools";

export const dynamic = "force-dynamic";

const STALE_RECOMMENDATION_DAYS = 30;

// POST /api/maintenance/auditor/run (Etapa 14) — event-driven trigger for
// now (a tenant admin or a future cron calls this); no periodic scheduler
// wired up this round, documented as a known gap rather than pretended.
// Deterministic scan (auditFleet(), no LLM) over every active asset's
// already-computed health score + predictive risk (reusing the same
// tool functions the Copilot uses, not a third re-implementation),
// upserted into maintenance_insights with ignoreDuplicates on
// (tenant_id, insight_key) so re-running never spawns a duplicate of a
// condition already open.
export async function POST(_req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.maintenance.ai_use"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: assets, error: assetsError } = await scope.db
    .from("assets")
    .select("id, name")
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null);
  if (assetsError) return internalError(assetsError);

  const signals: FleetAssetSignal[] = [];
  for (const asset of assets ?? []) {
    const [healthScore, predictiveRisk] = await Promise.all([
      toolGetAssetHealthScore(scope, asset.id),
      toolGetAssetPredictiveRisk(scope, asset.id),
    ]);
    if ("error" in healthScore || "error" in predictiveRisk) continue;
    signals.push({
      assetId: asset.id,
      assetName: asset.name as string,
      healthScore,
      predictiveRisk,
    });
  }

  const staleCutoff = new Date(Date.now() - STALE_RECOMMENDATION_DAYS * 86_400_000).toISOString();
  const { count: staleRecommendationsCount } = await scope.db
    .from("maintenance_recommendations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", scope.tenantId)
    .eq("status", "pending")
    .lt("created_at", staleCutoff);

  const drafts = auditFleet({
    assets: signals,
    staleRecommendationsCount: staleRecommendationsCount ?? 0,
  });

  if (drafts.length > 0) {
    const { error: upsertError } = await scope.db.from("maintenance_insights").upsert(
      drafts.map((d) => ({
        tenant_id: scope.tenantId,
        asset_id: d.assetId,
        type: d.type,
        severity: d.severity,
        message: d.message,
        insight_key: d.insightKey,
      })),
      { onConflict: "tenant_id,insight_key", ignoreDuplicates: true },
    );
    if (upsertError) return internalError(upsertError);
  }

  // Auto-resolve: a "critical_health_asset" insight is transient by
  // nature -- once an asset is no longer critical, close any open
  // insight for it instead of leaving a stale alarm forever. Fleet-level
  // insight types (cluster/low-average/stale-recommendations) are left
  // for a human to dismiss via PATCH, same as recommendations -- those
  // reflect a broader judgment call, not a single measurable fact.
  const stillCriticalAssetIds = new Set(
    drafts.filter((d) => d.type === "critical_health_asset").map((d) => d.assetId),
  );
  const { data: openCriticalInsights } = await scope.db
    .from("maintenance_insights")
    .select("id, asset_id")
    .eq("tenant_id", scope.tenantId)
    .eq("type", "critical_health_asset")
    .eq("status", "open");
  const toAutoResolve = (openCriticalInsights ?? [])
    .filter((row) => !stillCriticalAssetIds.has(row.asset_id))
    .map((row) => row.id);
  if (toAutoResolve.length > 0) {
    await scope.db
      .from("maintenance_insights")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .in("id", toAutoResolve);
  }

  return NextResponse.json({
    data: { insightsGenerated: drafts.length, assetsScanned: signals.length },
  });
}
