import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["acknowledged", "dismissed"] as const;

// PATCH /api/maintenance/insights/:id — human decision on a fleet-level
// insight (asset-level "critical_health_asset" insights also auto-
// resolve once the condition clears, see auditor/run/route.ts, but a
// human can still dismiss one early through here too).
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

  const body = (await req.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 422 },
    );
  }

  const { data: current, error: fetchError } = await scope.db
    .from("maintenance_insights")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Insight not found" }, { status: 404 });

  const { error: updateError } = await scope.db
    .from("maintenance_insights")
    .update({
      status: body.status,
      acknowledged_by: scope.userId,
      acknowledged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  return NextResponse.json({ data: { ok: true } });
}
