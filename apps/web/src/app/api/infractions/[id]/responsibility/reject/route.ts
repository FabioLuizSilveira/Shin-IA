import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { canTransitionCase, type InfractionCaseStatus } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

// POST /api/infractions/:id/responsibility/reject — item 12's "Sem
// responsável identificado" outcome. Sends the case back to
// responsibility_pending (clearing the suggestion) so it can be
// re-suggested or manually assigned later — never leaves a rejected
// suggestion sitting in a confirmed-looking state.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.assign_responsibility"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await scope.db
    .from("infraction_cases")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (!canTransitionCase(current.status as InfractionCaseStatus, "responsibility_pending")) {
    return NextResponse.json(
      { error: `cannot reject responsibility from status ${current.status}` },
      { status: 422 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { reason?: string };

  const { error: updateError } = await scope.db
    .from("infraction_cases")
    .update({
      status: "responsibility_pending",
      responsible_party_type: null,
      responsible_party_id: null,
      responsibility_confidence: null,
      responsibility_confirmed_by: null,
      responsibility_confirmed_at: null,
      responsibility_rejected_by: scope.userId,
      responsibility_rejected_at: new Date().toISOString(),
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
    action: "responsibility_rejected",
    metadata: { reason: body.reason ?? null },
  });

  return NextResponse.json({ data: { ok: true } });
}
