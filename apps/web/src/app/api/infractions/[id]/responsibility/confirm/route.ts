import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { canTransitionCase, type InfractionResponsiblePartyType } from "@shina/infractions-engine";
import { ensureInfractionCharge } from "@/lib/infraction-billing";

export const dynamic = "force-dynamic";

interface ConfirmBody {
  // Allows a human to override the suggestion outright (item 12: "Confirmar
  // / Alterar / Sem responsável identificado") — confirming isn't limited
  // to rubber-stamping whatever the algorithm proposed.
  responsiblePartyType?: InfractionResponsiblePartyType;
  responsiblePartyId?: string | null;
}

// POST /api/infractions/:id/responsibility/confirm — the human-in-the-loop
// gate (item 12). Only this route ever sets responsibility_confirmed_at —
// suggest never does.
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
    .select("id, status, contract_id, responsible_party_type, responsible_party_id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (!canTransitionCase(current.status, "responsibility_confirmed")) {
    return NextResponse.json(
      { error: `cannot confirm responsibility from status ${current.status}` },
      { status: 422 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as ConfirmBody;
  const responsibleType = body.responsiblePartyType ?? current.responsible_party_type;
  const responsibleId =
    body.responsiblePartyId !== undefined ? body.responsiblePartyId : current.responsible_party_id;

  const { error: updateError } = await scope.db
    .from("infraction_cases")
    .update({
      status: "responsibility_confirmed",
      responsible_party_type: responsibleType,
      responsible_party_id: responsibleId,
      responsibility_confirmed_by: scope.userId,
      responsibility_confirmed_at: new Date().toISOString(),
      responsibility_rejected_by: null,
      responsibility_rejected_at: null,
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
    action: "responsibility_confirmed",
    metadata: {
      responsibleType,
      responsibleId,
      overridden: body.responsiblePartyType !== undefined,
    },
  });

  const recipient =
    responsibleType === "operator" && responsibleId
      ? { operatorId: responsibleId }
      : responsibleType === "customer" && responsibleId
        ? { customerId: responsibleId }
        : undefined;
  void createNotification({
    tenantId: scope.tenantId,
    subject: "Responsabilidade de infração confirmada",
    body: "Um responsável foi confirmado para uma infração.",
    priority: "normal",
    recipient,
  });

  // Fase G: cobre o caso em que o pagamento to_authority já existia antes
  // da confirmação (a ordem pode ir nos dois sentidos) -- ensureInfractionCharge()
  // é idempotente e decide sozinha se um pagamento elegível já existe.
  void ensureInfractionCharge(scope.db, {
    id: current.id,
    tenant_id: scope.tenantId,
    contract_id: current.contract_id,
    responsible_party_type: responsibleType,
    responsible_party_id: responsibleId,
    responsibility_confirmed_at: new Date().toISOString(),
  });

  return NextResponse.json({ data: { ok: true } });
}
