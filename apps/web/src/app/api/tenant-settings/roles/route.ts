import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope, isTenantAdmin } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data: roles, error } = await scope.db
    .from("tenant_roles")
    .select("id, key, name, description, is_system, created_at")
    .eq("tenant_id", scope.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return internalError(error);

  const roleIds = (roles ?? []).map((r) => r.id);
  const { data: counts, error: countsError } = await scope.db
    .from("tenant_role_permissions")
    .select("role_id")
    .in("role_id", roleIds.length > 0 ? roleIds : ["00000000-0000-0000-0000-000000000000"]);
  if (countsError) return internalError(countsError);

  const permCountByRole = new Map<string, number>();
  for (const row of counts ?? []) {
    permCountByRole.set(row.role_id, (permCountByRole.get(row.role_id) ?? 0) + 1);
  }

  return NextResponse.json({
    data: (roles ?? []).map((r) => ({ ...r, permission_count: permCountByRole.get(r.id) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  if (!isTenantAdmin(scope)) {
    return NextResponse.json(
      { error: "Only tenant owners/admins can create roles" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as { key?: string; name?: string; description?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 422 });
  }

  const { data, error } = await scope.db
    .from("tenant_roles")
    .insert({
      tenant_id: scope.tenantId,
      key: body.key?.trim() || null,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      is_system: false,
    })
    .select("id, key, name, description, is_system, created_at")
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data: { ...data, permission_count: 0 } }, { status: 201 });
}
