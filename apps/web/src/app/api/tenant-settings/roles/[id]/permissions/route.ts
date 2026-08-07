import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import {
  requireTenantScope,
  isReadOnlyScope,
  isTenantAdmin,
  type TenantScope,
} from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

async function assertOwnedRole(scope: TenantScope, id: string) {
  const { data } = await scope.db
    .from("tenant_roles")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .maybeSingle();
  return !!data;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (!(await assertOwnedRole(scope, id))) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const { data, error } = await scope.db
    .from("tenant_role_permissions")
    .select("permission_id")
    .eq("role_id", id);
  if (error) return internalError(error);

  return NextResponse.json({ data: (data ?? []).map((r) => r.permission_id) });
}

// Toggles a single permission on/off for a role — simpler and safer than
// replacing the whole set from the client on every checkbox click.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!isTenantAdmin(scope)) {
    return NextResponse.json(
      { error: "Only tenant owners/admins can change role permissions" },
      { status: 403 },
    );
  }
  if (!(await assertOwnedRole(scope, id))) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const body = (await req.json()) as { permission_id?: string; grant?: boolean };
  if (!body.permission_id || typeof body.grant !== "boolean") {
    return NextResponse.json({ error: "permission_id and grant are required" }, { status: 422 });
  }

  if (body.grant) {
    const { error } = await scope.db
      .from("tenant_role_permissions")
      .insert({ role_id: id, permission_id: body.permission_id });
    if (error) return internalError(error);
  } else {
    const { error } = await scope.db
      .from("tenant_role_permissions")
      .delete()
      .eq("role_id", id)
      .eq("permission_id", body.permission_id);
    if (error) return internalError(error);
  }

  return NextResponse.json({ data: { ok: true } });
}
