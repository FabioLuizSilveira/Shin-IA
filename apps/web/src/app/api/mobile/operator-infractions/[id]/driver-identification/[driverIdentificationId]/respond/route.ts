import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireMobileContext } from "@/lib/mobile-context";
import { logActivity } from "@/lib/activity-log";
import { canTransitionCase, type InfractionCaseStatus } from "@shina/infractions-engine";

export const dynamic = "force-dynamic";

interface RespondBody {
  acknowledgment?: "confirmed" | "disputed";
  notes?: string;
}

// POST /api/mobile/operator-infractions/:id/driver-identification/:driverIdentificationId/respond
// — closes the "self-service de escrita do operador" gap documented in
// INFRACTIONS_ENGINE.md. Never touches the staff-managed `status` column
// (pending/ready/submitted/accepted/rejected/expired, the official
// protocol workflow) — only records what the operator themselves said
// (operator_acknowledgment/operator_acknowledged_at/operator_notes, new
// columns). A "disputed" response reuses the exact same
// infraction_disputes mechanism the tenant staff route already uses
// (POST .../disputes) rather than inventing a parallel dispute concept —
// party_type/party_id are always forced server-side to this operator's
// own identity, never accepted from the request body.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; driverIdentificationId: string }> },
) {
  const { id, driverIdentificationId } = await params;
  const context = await requireMobileContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  if (context.userType !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: infractionCase, error: caseError } = await context.db
    .from("infraction_cases")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", context.tenantId)
    .eq("operator_id", context.operatorId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const { data: driverId, error: driverIdError } = await context.db
    .from("infraction_driver_identifications")
    .select("id, operator_id, operator_acknowledgment")
    .eq("id", driverIdentificationId)
    .eq("case_id", id)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();
  if (driverIdError) return internalError(driverIdError);
  // Never trust the case-ownership check alone — this row must ALSO name
  // this specific operator, not just belong to a case they're linked to.
  if (!driverId || driverId.operator_id !== context.operatorId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (driverId.operator_acknowledgment) {
    return NextResponse.json(
      { error: `already responded ("${driverId.operator_acknowledgment}")` },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as RespondBody;
  if (body.acknowledgment !== "confirmed" && body.acknowledgment !== "disputed") {
    return NextResponse.json(
      { error: 'acknowledgment must be "confirmed" or "disputed"' },
      { status: 400 },
    );
  }

  const { error: updateError } = await context.db
    .from("infraction_driver_identifications")
    .update({
      operator_acknowledgment: body.acknowledgment,
      operator_acknowledged_at: new Date().toISOString(),
      operator_notes: body.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", driverIdentificationId)
    .eq("tenant_id", context.tenantId);
  if (updateError) return internalError(updateError);

  if (body.acknowledgment === "disputed") {
    const disputeId = crypto.randomUUID();
    const { error: disputeError } = await context.db.from("infraction_disputes").insert({
      id: disputeId,
      tenant_id: context.tenantId,
      case_id: id,
      party_type: "operator",
      party_id: context.operatorId,
      reason: "driver_identification_disputed",
      description:
        body.notes?.trim() ||
        "Operador contesta a indicação de condutor pelo app (não estava dirigindo).",
      status: "open",
    });
    if (disputeError) return internalError(disputeError);

    if (canTransitionCase(infractionCase.status as InfractionCaseStatus, "disputed")) {
      await context.db
        .from("infraction_cases")
        .update({ status: "disputed", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", context.tenantId);
    }
  }

  void logActivity(context.db, {
    tenantId: context.tenantId,
    actorId: context.operatorId,
    entityType: "infraction_driver_identification",
    entityId: driverIdentificationId,
    action: "operator_responded",
    metadata: { acknowledgment: body.acknowledgment },
  });

  return NextResponse.json({ data: { ok: true } });
}
