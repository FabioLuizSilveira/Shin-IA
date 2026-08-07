import { NextResponse, type NextRequest } from "next/server";
import { internalError } from "@/lib/api-error";
import { requireTenantScope, isReadOnlyScope } from "@/lib/tenant-context";
import { requirePlatformRole } from "@/lib/platform-guard";

export const dynamic = "force-dynamic";

// tenant_permissions has no tenant_id column — it's a single shared catalog
// across all tenants by design (see migration comment), so this list is
// intentionally not filtered by scope.tenantId.
export async function GET() {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const { data, error } = await scope.db
    .from("tenant_permissions")
    .select("id, key, resource, action, name, description, is_system")
    .is("deleted_at", null)
    .order("resource", { ascending: true })
    .order("action", { ascending: true });
  if (error) return internalError(error);

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const scope = await requireTenantScope();
  if ("error" in scope) return NextResponse.json({ error: scope.error }, { status: scope.status });
  if (isReadOnlyScope(scope)) {
    return NextResponse.json({ error: "Read-only impersonation session" }, { status: 403 });
  }
  // tenant_permissions is a single catalog shared across every tenant on
  // the platform (see the GET comment above) — a per-tenant admin gate
  // isn't enough here, since any tenant admin would still be able to
  // pollute every other tenant's permission catalog. This requires actual
  // platform staff.
  const platform = await requirePlatformRole();
  if ("error" in platform) {
    return NextResponse.json({ error: platform.error }, { status: platform.status });
  }

  const body = (await req.json()) as {
    resource?: string;
    action?: string;
    name?: string;
    description?: string;
  };

  if (!body.resource?.trim() || !body.action?.trim() || !body.name?.trim()) {
    return NextResponse.json({ error: "resource, action and name are required" }, { status: 422 });
  }
  const key = `${body.resource.trim()}:${body.action.trim()}`;

  const { data, error } = await scope.db
    .from("tenant_permissions")
    .insert({
      key,
      resource: body.resource.trim(),
      action: body.action.trim(),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      is_system: false,
    })
    .select("id, key, resource, action, name, description, is_system")
    .single();
  if (error) return internalError(error);

  return NextResponse.json({ data }, { status: 201 });
}
