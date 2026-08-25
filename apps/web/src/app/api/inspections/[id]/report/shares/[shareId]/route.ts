import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, hasTenantPermission } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

// DELETE /api/inspections/:id/report/shares/:shareId — revocation (item 9
// of the spec). Sets revoked_at rather than deleting the row, so the
// audit trail (who created it, who accessed it, when it was revoked)
// survives.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const { id, shareId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!(await hasTenantPermission(scope, "tenant.inspections.share"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: share, error: fetchError } = await scope.db
    .from("inspection_report_shares")
    .select("id, revoked_at")
    .eq("id", shareId)
    .eq("inspection_id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!share) return NextResponse.json({ error: "Share not found" }, { status: 404 });
  if (share.revoked_at) return NextResponse.json({ data: { ok: true } });

  const { error: updateError } = await scope.db
    .from("inspection_report_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("tenant_id", scope.tenantId);
  if (updateError) return internalError(updateError);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "inspection",
    entityId: id,
    action: "report_share_revoked",
    metadata: { shareId },
  });

  return NextResponse.json({ data: { ok: true } });
}
