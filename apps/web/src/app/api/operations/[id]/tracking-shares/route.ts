import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";
import { MESSAGING_AUDIT_EVENTS } from "@/lib/messaging-audit-events";
import {
  createTripTrackingShare,
  revokeTripTrackingShare,
} from "@/lib/transport/trip-tracking-share";
import { appUrl } from "@/lib/domain";

export const dynamic = "force-dynamic";

// WAVE 5 — secure customer trip tracking links (spec section 27). Mirrors
// api/inspections/[id]/report/shares/route.ts's shape exactly. `id` here
// is an operations.id — a Trip IS an operations row (Wave 3's own design
// decision), so this lives under /api/operations rather than inventing a
// separate /api/trips URL space for the same table.
interface CreateShareBody {
  ttlHours?: number;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.trips.share"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: op, error: opError } = await scope.db
    .from("operations")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (opError) return internalError(opError);
  if (!op) return NextResponse.json({ error: "Operação não encontrada" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as CreateShareBody;

  try {
    const share = await createTripTrackingShare(scope.db, {
      tenantId: scope.tenantId,
      operationId: id,
      createdBy: scope.userId,
      ttlHours: body.ttlHours,
      appUrl,
    });
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "operation",
      entityId: id,
      action: MESSAGING_AUDIT_EVENTS.TRIP_TRACKING_LINK_CREATED,
      metadata: { shareId: share.id, expiresAt: share.expiresAt },
    });
    return NextResponse.json({ data: share }, { status: 201 });
  } catch (err) {
    return internalError(err);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await hasTenantPermission(scope, "tenant.trips.share"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await scope.db
    .from("trip_tracking_shares")
    .select("id, created_at, expires_at, revoked_at, last_accessed_at, access_count")
    .eq("operation_id", id)
    .eq("tenant_id", scope.tenantId)
    .order("created_at", { ascending: false });
  if (error) return internalError(error);
  return NextResponse.json({ data: data ?? [] });
}

interface RevokeBody {
  shareId?: string;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.trips.share"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as RevokeBody | null;
  if (!body?.shareId) {
    return NextResponse.json({ error: "shareId é obrigatório" }, { status: 422 });
  }

  try {
    await revokeTripTrackingShare(scope.db, scope.tenantId, body.shareId);
    void logActivity(scope.db, {
      tenantId: scope.tenantId,
      actorId: scope.userId,
      entityType: "operation",
      entityId: id,
      action: MESSAGING_AUDIT_EVENTS.TRIP_TRACKING_LINK_REVOKED,
      metadata: { shareId: body.shareId },
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return internalError(err);
  }
}
