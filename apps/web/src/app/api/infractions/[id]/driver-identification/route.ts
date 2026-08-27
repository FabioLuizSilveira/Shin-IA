import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";

export const dynamic = "force-dynamic";

interface CreateDriverIdBody {
  operatorId?: string;
  driverName?: string;
  driverDocument?: string;
}

// POST /api/infractions/:id/driver-identification — item 20. Minimizes
// personal data (item 47): when the driver is an already-registered
// operator, only operator_id is stored, never a name/document
// duplicated from the operators table. Free-text driverName/
// driverDocument only apply to a driver with no Shinã record.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (caseError) return internalError(caseError);
  if (!infractionCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const body = (await req.json()) as CreateDriverIdBody;
  if (!body.operatorId && !body.driverName) {
    return NextResponse.json({ error: "operatorId or driverName is required" }, { status: 400 });
  }

  const driverIdId = crypto.randomUUID();
  const { error: insertError } = await scope.db.from("infraction_driver_identifications").insert({
    id: driverIdId,
    tenant_id: scope.tenantId,
    case_id: id,
    operator_id: body.operatorId ?? null,
    driver_name: body.operatorId ? null : (body.driverName ?? null),
    driver_document: body.operatorId ? null : (body.driverDocument ?? null),
    status: "ready",
    submitted_by: scope.userId,
  });
  if (insertError) return internalError(insertError);

  await scope.db
    .from("infraction_cases")
    .update({ status: "driver_identification_pending", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "infraction_case",
    entityId: id,
    action: "driver_identification_registered",
    metadata: { driverIdId, operatorId: body.operatorId ?? null },
  });

  if (body.operatorId) {
    void createNotification({
      tenantId: scope.tenantId,
      subject: "Indicação de condutor registrada",
      body: "Você foi indicado como condutor em uma infração.",
      priority: "normal",
      recipient: { operatorId: body.operatorId },
    });
  }

  return NextResponse.json({ data: { id: driverIdId } }, { status: 201 });
}
