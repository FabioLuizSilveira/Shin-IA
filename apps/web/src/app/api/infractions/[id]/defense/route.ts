import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { canTransitionCase } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

interface CreateDefenseBody {
  kind?: "defense" | "appeal";
  notes?: string;
}

// POST /api/infractions/:id/defense — item 23. Administrative record
// only in V1 (draft/submitted/under_analysis/accepted/rejected/expired)
// -- never auto-protocols with a public authority (item 23/59/60).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.manage_defense"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: infractionCase, error: caseError } = await scope.db
    .from("infraction_cases")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const body = (await req.json()) as CreateDefenseBody;
  const kind = body.kind ?? "defense";

  const defenseId = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("infraction_defenses").insert({
    id: defenseId,
    tenant_id: scope.tenantId,
    case_id: id,
    kind,
    status: "draft",
    notes: body.notes ?? null,
    created_by: scope.userId,
  });
  if (insertError) return internalError(insertError);

  const targetStatus = kind === "appeal" ? "appealed" : "defense_pending";
  if (canTransitionCase(infractionCase.status, targetStatus)) {
    await scope.db
      .from("infraction_cases")
      .update({ status: targetStatus, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", scope.tenantId);
  }

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_case",
    entityId: id,
    action: kind === "appeal" ? "appeal_registered" : "defense_registered",
    metadata: { defenseId },
  });

  return NextResponse.json({ data: { id: defenseId } }, { status: 201 });
}
