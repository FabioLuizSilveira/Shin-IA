import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { resolveTemporalContext } from "@/lib/infraction-temporal-resolver";
import { canTransitionCase, type InfractionCaseStatus } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

// POST /api/infractions/:id/responsibility/suggest — runs temporal
// matching + suggestResponsibility() and persists the suggestion. This is
// ALWAYS a suggestion, never a decision (item 12 — human-in-the-loop):
// responsibility_confirmed_at stays null until a human calls the confirm
// route below.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.infractions.review"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: infractionCase, error: caseError } = await scope.db
    .from("infraction_cases")
    .select("id, infraction_id, asset_id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (!infractionCase.asset_id) {
    return NextResponse.json(
      { error: "Não é possível sugerir responsável sem um ativo identificado." },
      { status: 422 },
    );
  }
  // Found live while writing the E2E happy-path check: this route used
  // to overwrite status unconditionally, bypassing canTransitionCase
  // entirely -- the only route in the module that did. matched/
  // responsibility_pending/responsibility_suggested (re-run) are all
  // valid sources for "responsibility_suggested" per the transition map.
  if (
    !canTransitionCase(infractionCase.status as InfractionCaseStatus, "responsibility_suggested")
  ) {
    return NextResponse.json(
      { error: `cannot suggest responsibility from status ${infractionCase.status}` },
      { status: 422 },
    );
  }

  const { data: infraction, error: infrError } = await scope.db
    .from("infractions")
    .select("occurred_at")
    .eq("id", infractionCase.infraction_id)
    .maybeSingle();
  if (infrError) return internalError(infrError);
  if (!infraction) return internalError(new Error("infraction row missing for case"));

  const temporal = await resolveTemporalContext(
    scope.db,
    scope.tenantId,
    infractionCase.asset_id,
    infraction.occurred_at,
  );

  const { error: updateError } = await scope.db
    .from("infraction_cases")
    .update({
      status: "responsibility_suggested",
      contract_id: temporal.contract?.id ?? null,
      operation_id: temporal.operation?.id ?? null,
      allocation_id: temporal.allocation?.id ?? null,
      customer_id: temporal.customerId,
      operator_id:
        temporal.suggestion.responsibleType === "operator"
          ? temporal.suggestion.responsibleId
          : null,
      responsible_party_type: temporal.suggestion.responsibleType,
      responsible_party_id: temporal.suggestion.responsibleId,
      responsibility_confidence: temporal.suggestion.confidence,
      responsibility_reasons: temporal.suggestion.reasons,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  // Evidence trail (item 14) — every fact the suggestion was built from,
  // recorded individually so a human reviewer can see exactly what was
  // consulted, not just the final confidence number.
  const evidenceRows: { type: string; source: string; reference: string | null }[] = [];
  if (temporal.contract)
    evidenceRows.push({
      type: "contract",
      source: "temporal_match",
      reference: temporal.contract.id,
    });
  if (temporal.operation)
    evidenceRows.push({
      type: "operation",
      source: "temporal_match",
      reference: temporal.operation.id,
    });
  if (temporal.allocation)
    evidenceRows.push({
      type: "allocation",
      source: "temporal_match",
      reference: temporal.allocation.id,
    });
  if (temporal.operatorAssignment)
    evidenceRows.push({
      type: "operator_assignment",
      source: "temporal_match",
      reference: temporal.operatorAssignment.operatorId,
    });
  if (temporal.trackingConfirmed)
    evidenceRows.push({ type: "tracking", source: "resource_locations", reference: null });

  if (evidenceRows.length > 0) {
    await scope.db.from("infraction_evidence").insert(
      evidenceRows.map((e) => ({
        tenant_id: scope.tenantId,
        case_id: id,
        type: e.type,
        source: e.source,
        reference: e.reference,
        metadata: {},
        created_by: scope.userId,
      })),
    );
  }

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_case",
    entityId: id,
    action: "responsibility_suggested",
    metadata: { suggestion: temporal.suggestion },
  });

  return NextResponse.json({ data: temporal.suggestion });
}
