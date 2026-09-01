import { NextRequest, NextResponse } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["accepted", "dismissed"] as const;
type DecisionStatus = (typeof VALID_STATUSES)[number];

interface PatchBody {
  status?: string;
}

// PATCH /api/maintenance/recommendations/:id — the human-in-the-loop half
// of Etapa 7: a recommendation is only ever a suggestion until a person
// explicitly accepts or dismisses it here. Nothing in this module ever
// calls this route itself.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.maintenance.ai_use"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.status || !VALID_STATUSES.includes(body.status as DecisionStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 422 },
    );
  }

  const { data: current, error: fetchError } = await scope.db
    .from("maintenance_recommendations")
    .select("id, asset_id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });

  const { error: updateError } = await scope.db
    .from("maintenance_recommendations")
    .update({
      status: body.status,
      decided_by: scope.userId,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "maintenance_recommendation",
    entityId: id,
    action: body.status === "accepted" ? "accepted" : "dismissed",
    metadata: { assetId: current.asset_id },
  });

  return NextResponse.json({ data: { ok: true } });
}
