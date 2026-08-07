import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["available", "busy", "offline", "suspended"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }

  const body = (await req.json()) as { status?: string };
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "a valid status is required" }, { status: 422 });
  }

  const { error } = await scope.db
    .from("resources")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
