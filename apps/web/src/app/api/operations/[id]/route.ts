import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { OperationContractGate } from "@shina/tenant-contract-engine";
import { ALLOWED_TRANSITIONS, resolveOperationContractId } from "@/lib/operation-transitions";

export const dynamic = "force-dynamic";

const SELECT =
  "id, type, status, scheduled_starts_at, scheduled_ends_at, started_at, completed_at, created_at, description, metadata, resources(id, name, type, status), assets(id, name, category, status)";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("operations")
    .select(SELECT)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (error) return internalError(error);
  if (!data) return NextResponse.json({ error: "Operation not found" }, { status: 404 });

  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { status?: string; description?: string };
  if (!body.status && body.description === undefined) {
    return NextResponse.json({ error: "status or description is required" }, { status: 400 });
  }

  // Wave 2 Phase B: closes a real gap the mobile audit surfaced — the
  // "operations:write" permission already existed in the catalog but this
  // route never checked it (only 6 routes in the whole app called
  // hasTenantPermission() before this session). Without this, the mobile
  // allowedActions computation would have promised a check this route
  // didn't actually enforce.
  if (body.status && !(await hasTenantPermission(scope, "operations:write"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: current, error: fetchError } = await scope.db
    .from("operations")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!current) return NextResponse.json({ error: "Operation not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // The description is just a free-text note ("what actually happened") —
  // it can be added/edited regardless of status, unlike the status field
  // itself which follows the state machine below.
  if (body.description !== undefined) {
    update.description = body.description.trim() || null;
  }

  if (body.status) {
    const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: `cannot transition from ${current.status} to ${body.status}` },
        { status: 422 },
      );
    }

    // OperationContractGate — pending -> in_progress is the real "release
    // the operation" moment in this 5-state enum (the spec's separate
    // approved/scheduled states don't exist here, documented deviation).
    // Only the customer side gates: an operator is typically the tenant's
    // own employee or the equipment owner, never a release precondition.
    if (body.status === "in_progress") {
      const contractId = await resolveOperationContractId(scope.db, id);

      const gateResult = await OperationContractGate.check(scope.db, {
        contractId,
      });
      if (gateResult.blocked) {
        void logActivity(scope.db, {
          tenantId: scope.tenantId,
          actorId: scope.userId,
          entityType: "operation",
          entityId: id,
          action: "contract.operation_blocked",
          metadata: { reasons: gateResult.reasons },
        });
        return NextResponse.json(
          { error: "contract_requirement_not_met", reasons: gateResult.reasons },
          { status: 422 },
        );
      }
      if (contractId) {
        void logActivity(scope.db, {
          tenantId: scope.tenantId,
          actorId: scope.userId,
          entityType: "operation",
          entityId: id,
          action: "contract.operation_released",
        });
      }
    }

    update.status = body.status;
    if (body.status === "in_progress") update.started_at = new Date().toISOString();
    if (body.status === "completed") update.completed_at = new Date().toISOString();
  }

  const { error: updateError } = await scope.db
    .from("operations")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  if (!body.status) {
    return NextResponse.json({ data: { ok: true } });
  }

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "operation",
    entityId: id,
    action: "status_changed",
    metadata: { from: current.status, to: body.status },
  });

  // Only notify on outcomes that need attention — routine progress
  // transitions (pending -> in_progress -> completed) would just be noise.
  if (body.status === "cancelled" || body.status === "failed") {
    void createNotification({
      tenantId: scope.tenantId,
      subject: body.status === "failed" ? "Operação falhou" : "Operação cancelada",
      body: `A operação foi marcada como ${body.status === "failed" ? "falhou" : "cancelada"}.`,
      priority: "high",
    });
  }

  return NextResponse.json({ data: { ok: true } });
}
