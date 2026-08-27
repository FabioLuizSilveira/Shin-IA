import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { resolveAssetMatch } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

// POST /api/infractions/:id/match — re-run asset matching for a case
// already belonging to this tenant (e.g. a corrected plate/renavam).
// Genuinely UNMATCHED cases (tenant_id still null — item 5) are NOT
// reachable through a tenant-scoped route by construction: nobody has a
// tenant to be scoped to yet. Their reprocessing (item 32: "Asset é
// cadastrado posteriormente; reprocessamento executado") is a system-level
// sweep, wired into the deadline cron in Fase E, not a user-triggered
// endpoint here — documented as a deliberate scope decision, not an
// oversight.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.update"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: infractionCase, error: caseError } = await scope.db
    .from("infraction_cases")
    .select("id, infraction_id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const { data: infraction, error: infrError } = await scope.db
    .from("infractions")
    .select("plate, renavam")
    .eq("id", infractionCase.infraction_id)
    .maybeSingle();
  if (infrError) return internalError(infrError);
  if (!infraction) return internalError(new Error("infraction row missing for case"));

  const { data: candidateRows } = await scope.db
    .from("assets")
    .select("id, tenant_id, plate, renavam")
    .eq("tenant_id", scope.tenantId)
    .eq("plate", infraction.plate);
  const candidates = (candidateRows ?? []).map((r) => ({
    assetId: r.id,
    tenantId: r.tenant_id,
    plate: r.plate,
    renavam: r.renavam,
  }));
  const match = resolveAssetMatch(infraction.renavam, infraction.plate, candidates);

  const { error: updateError } = await scope.db
    .from("infraction_cases")
    .update({
      asset_id: match.assetId,
      match_confidence: match.confidence,
      status: match.assetId ? "matched" : "unmatched",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_case",
    entityId: id,
    action: "rematched",
    metadata: { matchConfidence: match.confidence },
  });

  return NextResponse.json({ data: { matchConfidence: match.confidence, assetId: match.assetId } });
}
