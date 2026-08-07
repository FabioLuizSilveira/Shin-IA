import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, isTenantAdmin } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!isTenantAdmin(scope)) {
    return NextResponse.json(
      { error: "Only tenant owners/admins can delete roles" },
      { status: 403 },
    );
  }

  const { data: role, error: fetchError } = await scope.db
    .from("tenant_roles")
    .select("is_system")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  if (fetchError) return internalError(fetchError);
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  if (role.is_system) {
    return NextResponse.json({ error: "system roles cannot be deleted" }, { status: 422 });
  }

  const { error } = await scope.db
    .from("tenant_roles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", scope.tenantId);
  if (error) return internalError(error);

  return NextResponse.json({ data: { ok: true } });
}
