import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id: contractId, documentId } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { status?: "approved" | "rejected"; review_notes?: string };
  if (!body.status || !["approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 422 });
  }

  const { data: updated, error } = await scope.db
    .from("contract_documents")
    .update({
      status: body.status,
      reviewed_by: scope.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: body.review_notes ?? null,
    })
    .eq("id", documentId)
    .eq("contract_id", contractId)
    .eq("tenant_id", scope.tenantId)
    .select("id, status")
    .single();
  if (error) return internalError(error);

  void logActivity(scope.db, {
    tenantId: scope.tenantId,
    actorId: scope.userId,
    entityType: "contract_document",
    entityId: documentId,
    action: body.status === "approved" ? "document.approved" : "document.rejected",
  });

  return NextResponse.json({ data: updated });
}
